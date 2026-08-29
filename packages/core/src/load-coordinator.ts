/**
 * Load Coordinator - Request deduplication for component on_load() calls
 *
 * Coordinates parallel component loading to prevent duplicate requests.
 * When multiple components with identical names and args load simultaneously,
 * only the first (leader) executes on_load(). Others (followers) wait for
 * the leader's result.
 *
 * Key Concepts:
 * - **INVOCATION_KEY**: Unique identifier for component name + args combination
 * - **Leader**: First component to reach on_load() for a given INVOCATION_KEY
 * - **Follower**: Subsequent components that wait for leader's result
 *
 * Lifecycle:
 * 1. Leader reaches on_load() → create coordination entry
 * 2. Followers reach on_load() → join waiting queue
 * 3. Leader completes → distribute data to all followers
 * 4. Clear coordination entry (no caching)
 *
 * @internal This class is not exposed in the public API
 */

import type { Jqhtml_Component } from './component.js';
import { serialize_for_cache_key } from './cache-key-serializer.js';

interface CoordinationEntry {
    status: 'loading' | 'completed' | 'failed';
    promise: Promise<void>;
    resolve_promise: () => void;  // Resolves when coordination completes (after data is ready)
    leader_component: Jqhtml_Component;
    leader_data: any;
    leader_error: Error | null;
    waiting: Jqhtml_Component[];
}

export interface InvocationKeyResult {
    key: string | null;
    uncacheable_property?: string;
    /** Why the property could not be keyed - 'function', 'circular', 'too-large', ... */
    uncacheable_reason?: string;
}

export interface InvocationKeyOptions {
    /**
     * Allow a plain-data object/array arg with no author-supplied cache id to be
     * keyed by DETERMINISTIC CONTENT.
     *
     * The CACHE passes true: two structurally equal args should hit the same
     * cache entry, and a wrong key there is corrected by stale-while-revalidate.
     *
     * DEDUPLICATION passes false (the default), deliberately. A deduplicated
     * follower never runs on_load() at all and adopts the leader's data with no
     * revalidation, so a key that is wrong there is permanently wrong data.
     * Redundant concurrent requests are cheaper than that risk.
     */
    allow_content_serialization?: boolean;
}

export class Load_Coordinator {
    private static _registry: Map<string, CoordinationEntry> = new Map();

    /**
     * Generate INVOCATION_KEY from component name and args
     * Uses deterministic JSON serialization (sorted keys)
     * Excludes internal properties (those starting with _)
     *
     * For functions/objects:
     * - Checks for ._jqhtml_cache_id property (assigned by RSpade)
     * - Falls back to .jqhtml_cache_id() method if property doesn't exist
     * - If neither exists, marks property as uncacheable
     *
     * Returns object with:
     * - key: Cache key string, or null if uncacheable
     * - uncacheable_property: Name of first property that prevented caching (for debugging)
     */
    static generate_invocation_key(
        component_name: string,
        args: any,
        options: InvocationKeyOptions = {}
    ): InvocationKeyResult {
        let uncacheable_property: string | undefined;
        let uncacheable_reason: string | undefined;

        // Filter out internal properties (starting with _) and serialize args
        const serializable_args: any = {};

        for (const key of Object.keys(args).sort()) {
            if (key.startsWith('_')) {
                continue; // Skip internal properties
            }

            // Skip framework properties that shouldn't affect cache identity
            // Note: _load_only and _load_render_only are already filtered by the _ prefix check above
            if (key === 'use_cached_data') {
                continue;
            }

            const value = args[key];
            const value_type = typeof value;

            // Handle primitives (string, number, boolean, null, undefined)
            if (value === null || value === undefined ||
                value_type === 'string' || value_type === 'number' ||
                value_type === 'boolean') {
                serializable_args[key] = value;
                continue;
            }

            // Handle functions and objects
            if (value_type === 'function' || value_type === 'object') {
                // Check for ._jqhtml_cache_id property (fastest, what RSpade assigns)
                if (value._jqhtml_cache_id !== undefined) {
                    serializable_args[key] = `__JQHTML_CACHE_ID__:${String(value._jqhtml_cache_id)}`;
                    continue;
                }

                // Check for .jqhtml_cache_id() method (more flexible, for custom objects)
                if (typeof value.jqhtml_cache_id === 'function') {
                    try {
                        const cache_id = value.jqhtml_cache_id();
                        serializable_args[key] = `__JQHTML_CACHE_ID__:${String(cache_id)}`;
                        continue;
                    } catch (error) {
                        // Method threw error - treat as uncacheable
                        if (!uncacheable_property) {
                            uncacheable_property = key;
                            uncacheable_reason = 'cache-id-threw';
                        }
                        return { key: null, uncacheable_property, uncacheable_reason };
                    }
                }

                // No author-supplied id. The cache may fall back to keying by
                // deterministic content; deduplication deliberately may not.
                if (options.allow_content_serialization) {
                    const serialized = serialize_for_cache_key(value);
                    if (serialized.ok) {
                        serializable_args[key] = `__JQHTML_CONTENT__:${serialized.text}`;
                        continue;
                    }
                    if (!uncacheable_property) {
                        uncacheable_property = key;
                        // This package compiles with strictNullChecks off, and without it
                        // TypeScript will not narrow a discriminated union by its boolean
                        // discriminant - so `serialized` is still the full Serialize_Result
                        // here even though `ok` has been ruled out above. The cast states
                        // what the control flow already guarantees.
                        uncacheable_reason = (serialized as { ok: false; reason: string }).reason;
                    }
                    return { key: null, uncacheable_property, uncacheable_reason };
                }

                if (!uncacheable_property) {
                    uncacheable_property = key;
                    uncacheable_reason = value_type === 'function' ? 'function' : 'object';
                }
                return { key: null, uncacheable_property, uncacheable_reason };
            }

            // Unknown type (symbol, bigint, etc.) - uncacheable
            if (!uncacheable_property) {
                uncacheable_property = key;
                uncacheable_reason = value_type;
            }
            return { key: null, uncacheable_property, uncacheable_reason };
        }

        // Try to serialize - if it fails (shouldn't happen now, but safety net), return null
        try {
            const sorted_args = JSON.stringify(serializable_args);
            return { key: `${component_name}::${sorted_args}` };
        } catch (error) {
            // Serialization failed unexpectedly
            return { key: null, uncacheable_property };
        }
    }

    /**
     * Check if a component should execute on_load() or wait for existing request
     * Returns true if component should execute (is leader), false if should wait (is follower)
     */
    static should_execute_on_load(component: Jqhtml_Component): boolean {
        const { key } = this.generate_invocation_key(component.component_name(), component.args);

        // No identity means no coordination. Without this, every un-keyable component
        // would share the single `null` registry entry and adopt an unrelated
        // component's data - the worst failure this system can produce.
        if (key === null) {
            return true;
        }

        const entry = this._registry.get(key);

        if (!entry) {
            // No existing request - this component becomes the leader
            return true;
        }

        if (entry.status === 'loading') {
            // Request in progress - this component becomes a follower
            entry.waiting.push(component);
            return false;
        }

        // Entry exists but completed/failed - should have been cleaned up
        // Treat as new leader
        return true;
    }

    /**
     * Register a leader component that will execute on_load()
     * Creates coordination entry and returns a function to call when data is ready
     *
     * @returns A function that accepts the final data and completes coordination
     */
    static register_leader(
        component: Jqhtml_Component,
        on_load_promise: Promise<void>
    ): (final_data: Record<string, any>) => void {
        const { key } = this.generate_invocation_key(component.component_name(), component.args);

        // Un-keyable component: run alone, register nothing. See should_execute_on_load().
        if (key === null) {
            return () => { /* no coordination to complete */ };
        }

        // Create a promise that we control - it resolves when complete_coordination is called
        let resolve_promise!: () => void;
        const coordination_promise = new Promise<void>((resolve) => {
            resolve_promise = resolve;
        });

        const entry: CoordinationEntry = {
            status: 'loading',
            promise: coordination_promise,  // Followers await THIS promise, not on_load_promise
            resolve_promise,
            leader_component: component,
            leader_data: null,
            leader_error: null,
            waiting: []
        };

        this._registry.set(key, entry);

        // Return cleanup function that accepts the final data
        return (final_data: Record<string, any>) => this._complete_coordination(key, component, final_data);
    }

    /**
     * Get the coordination promise for a follower component
     * Returns a promise that resolves when the leader completes
     */
    static get_coordination_promise(component: Jqhtml_Component): Promise<void> | null {
        const { key } = this.generate_invocation_key(component.component_name(), component.args);
        const entry = this._registry.get(key);

        if (!entry || entry.status !== 'loading') {
            return null;
        }

        return entry.promise;
    }

    /**
     * Complete coordination after leader's on_load() finishes
     * Stores leader's data, marks entry as completed, and resolves the promise.
     * Followers retrieve the data themselves via get_leader_data().
     *
     * @param key - The coordination key
     * @param leader - The leader component
     * @param final_data - The final data after on_load and normalization
     * @private
     */
    private static _complete_coordination(key: string, leader: Jqhtml_Component, final_data: Record<string, any>): void {
        const entry = this._registry.get(key);

        if (!entry) {
            return;
        }

        // Store the final data (already normalized by _apply_load_result)
        // Deep clone to avoid sharing proxy objects between components
        try {
            entry.leader_data = JSON.parse(JSON.stringify(final_data));
        } catch (error) {
            // If data can't be serialized, use direct reference (may have issues)
            entry.leader_data = final_data;
        }
        entry.status = 'completed';

        if ((window as any).jqhtml?.debug?.verbose) {
            console.log(
                `[Load Coordinator] Leader ${leader._cid} completed, data available for ${entry.waiting.length} followers`,
                { key, data: entry.leader_data }
            );
        }

        // Resolve the promise - followers waiting on it will now wake up
        entry.resolve_promise();

        // Note: We do NOT delete the entry here anymore.
        // Followers need to retrieve the data after the promise resolves.
        // Entry will be cleaned up when last follower retrieves data.
    }

    /**
     * Get leader's data for a follower component
     * Called by follower after coordination promise resolves
     * Returns the data and cleans up if this is the last follower
     */
    static get_leader_data(component: Jqhtml_Component): Record<string, any> | null {
        const { key } = this.generate_invocation_key(component.component_name(), component.args);

        if (!key) {
            return null;
        }

        const entry = this._registry.get(key);

        if (!entry || entry.status !== 'completed') {
            return null;
        }

        // Remove this follower from the waiting list
        const follower_index = entry.waiting.indexOf(component);
        if (follower_index !== -1) {
            entry.waiting.splice(follower_index, 1);
        }

        if ((window as any).jqhtml?.debug?.verbose) {
            console.log(
                `[Load Coordinator] Follower ${component._cid} retrieving data from leader ${entry.leader_component._cid}`,
                { key, remaining_followers: entry.waiting.length }
            );
        }

        // If this was the last follower, clean up the entry
        if (entry.waiting.length === 0) {
            this._registry.delete(key);

            if ((window as any).jqhtml?.debug?.verbose) {
                console.log(
                    `[Load Coordinator] Coordination complete for key: ${key}`,
                    { registry_size: this._registry.size }
                );
            }
        }

        return entry.leader_data;
    }

    /**
     * Handle leader on_load() error
     * Propagates error to all followers and cleans up entry
     */
    static handle_leader_error(component: Jqhtml_Component, error: Error): void {
        const { key } = this.generate_invocation_key(component.component_name(), component.args);
        const entry = this._registry.get(key);

        if (!entry) {
            return;
        }

        entry.leader_error = error;
        entry.status = 'failed';

        console.error(
            `[Load Coordinator] Leader ${component._cid} on_load() failed for key: ${key}`,
            error
        );

        // Propagate error to all followers
        // Note: Followers will handle errors the same way as if their own on_load() failed
        // This is transparent to the developer
        for (const follower of entry.waiting) {
            console.error(
                `[Load Coordinator] Follower ${follower._cid} failed due to leader error`,
                error
            );
            // The follower's lifecycle will handle the error naturally
            // as the promise rejection will propagate
        }

        // Clear coordination entry so future requests can retry
        this._registry.delete(key);

        if ((window as any).jqhtml?.debug?.verbose) {
            console.log(
                `[Load Coordinator] Cleared failed coordination for key: ${key}`,
                { followers_count: entry.waiting.length }
            );
        }
    }

    /**
     * Get current registry state (for debugging)
     */
    static get_registry_state(): any {
        const state: any = {};
        for (const [key, entry] of this._registry.entries()) {
            state[key] = {
                status: entry.status,
                leader_cid: entry.leader_component._cid,
                waiting_count: entry.waiting.length,
                waiting_cids: entry.waiting.map(c => c._cid)
            };
        }
        return state;
    }

    /**
     * Clear all coordination entries (for testing/debugging)
     */
    static clear_all(): void {
        this._registry.clear();
    }
}
