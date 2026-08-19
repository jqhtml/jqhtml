/**
 * Jqhtml_Local_Storage - Scoped local storage for JQHTML component caching
 *
 * Provides safe, scoped access to localStorage with automatic handling of
 * unavailable storage, quota exceeded errors, and scope invalidation.
 *
 * Key Features:
 * - **Manual scoping**: Cache key must be set via set_cache_key() before use
 * - **Graceful degradation**: Returns null when storage unavailable or cache key not set
 * - **Quota management**: Auto-clears storage when full and retries operation
 * - **Scope validation**: Clears storage when cache key changes
 * - **Developer-friendly keys**: Scoped suffix allows easy inspection in dev tools
 * - **Class-aware serialization**: ES6 class instances serialize and restore properly
 *
 * Class-Aware Serialization:
 * ES6 class instances can be serialized and deserialized if registered via
 * register_cache_class(). Classes are wrapped as {__jqhtml_class__: "Name", __jqhtml_props__: {...}}
 * and restored to proper instances on retrieval. Nested class instances in objects
 * and arrays are handled recursively.
 *
 * Scoping Strategy:
 * Storage is scoped by a user-provided cache key (typically a session identifier,
 * user ID, or combination of relevant scope factors). This scope is stored in
 * `_jqhtml_cache_key`. If the cache key changes between page loads, all JQHTML
 * storage is cleared to prevent stale data from different sessions/users.
 *
 * Key Format:
 * Keys are stored as: `jqhtml::developer_key::cache_key`
 * Example: `jqhtml::User_Profile_data::user_123`
 *
 * The `jqhtml::` prefix identifies JQHTML keys, allowing safe clearing of only our keys
 * without affecting other JavaScript libraries. This enables transparent coexistence
 * with third-party libraries that also use browser storage.
 *
 * Quota Exceeded Handling:
 * When storage quota is exceeded during a set operation, only JQHTML keys (prefixed with
 * `jqhtml::`) are cleared, preserving other libraries' data. The operation is then retried
 * once. This ensures the application continues functioning even when storage is full.
 *
 * Usage:
 *   // Register classes that need to be cached (call once at startup)
 *   jqhtml.register_cache_class(Contact_Model);
 *   jqhtml.register_cache_class(User_Profile);
 *
 *   // Must set cache key first (typically done once on page load)
 *   Jqhtml_Local_Storage.set_cache_key('user_123');
 *
 *   // Then use storage normally - ES6 classes serialize automatically
 *   Jqhtml_Local_Storage.set('cached_component', {
 *     contact: new Contact_Model(),
 *     timestamp: Date.now()
 *   });
 *   const cached = Jqhtml_Local_Storage.get('cached_component');
 *   // cached.contact instanceof Contact_Model === true
 *
 * IMPORTANT - Volatile Storage:
 * Storage can be cleared at any time due to:
 * - User clearing browser data
 * - Private browsing mode restrictions
 * - Quota exceeded errors
 * - Cache key changes
 * - Browser storage unavailable
 *
 * Therefore, NEVER store critical data. Only use for:
 * - Cached component HTML (performance optimization)
 * - Transient UI state (convenience, not required)
 *
 * @internal This class is not exposed in the public API
 */

// ============================================================================
// Class Registry for Serialization
// ============================================================================

// Registry mapping class names to constructors
const class_registry: Record<string, new (...args: any[]) => any> = Object.create(null);

// Markers for serialized class instances (unique to avoid collisions with user data)
// Replaced at build time by rollup (see rollup.config.js).
const CORE_VERSION = '__VERSION__';

const CLASS_MARKER = '__jqhtml_class__';
const PROPS_MARKER = '__jqhtml_props__';

/**
 * Register a class for cache serialization/deserialization.
 * Must be called before attempting to cache instances of this class.
 *
 * @param klass - The class constructor to register
 * @throws Error if klass is not a named function/class
 */
export function register_cache_class(klass: new (...args: any[]) => any): void {
    if (typeof klass !== 'function' || !klass.name) {
        throw new Error('[JQHTML Cache] register_cache_class requires a named class constructor');
    }
    class_registry[klass.name] = klass;
}

/**
 * Check if a class is registered for caching
 */
export function is_cache_class_registered(class_name: string): boolean {
    return class_name in class_registry;
}

// ============================================================================
// Serialization (Object → String)
// ============================================================================

/**
 * Serialize a value to JSON string, handling ES6 class instances recursively.
 * Returns null if serialization fails for any reason.
 *
 * @param value - The value to serialize
 * @param verbose - Whether to log warnings
 * @returns Serialized JSON string, or null if serialization failed
 */
function serialize_value(value: any, verbose: boolean): string | null {
    try {
        const seen = new WeakSet<object>();
        const processed = process_for_serialization(value, verbose, seen);

        if (processed === undefined) {
            // Serialization failed - undefined signals failure
            return null;
        }

        return JSON.stringify(processed);
    } catch (e) {
        if (verbose) {
            console.warn('[JQHTML Cache] Serialization failed:', e);
        }
        return null;
    }
}

/**
 * Recursively process a value for serialization.
 * Returns undefined if serialization should fail (unserializable value encountered).
 *
 * @param value - The value to process
 * @param verbose - Whether to log warnings
 * @param seen - WeakSet to detect circular references
 * @returns Processed value ready for JSON.stringify, or undefined if failed
 */
function process_for_serialization(value: any, verbose: boolean, seen: WeakSet<object>): any {
    // Handle null and undefined
    if (value === null) {
        return null;
    }
    if (value === undefined) {
        return undefined; // JSON.stringify will omit this property
    }

    // Handle primitives
    if (typeof value !== 'object') {
        // string, number, boolean are fine
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }

        // bigint, symbol, function cannot be serialized
        if (verbose) {
            console.warn(`[JQHTML Cache] Cannot serialize ${typeof value} - value will be omitted`);
        }
        // Return undefined to omit this value (not fail entire serialization)
        return undefined;
    }

    // Handle circular references.
    // `seen` tracks only the current ancestor path (the DFS stack): an object is
    // added on the way down and removed on the way back up (see finally below).
    // This flags a genuine cycle (a back-edge to an ancestor) while allowing a
    // shared reference in a DAG to be serialized independently on each visit.
    // JSON round-trip semantics do not preserve identity anyway, so emitting a
    // copy per reference is correct; silently omitting the property is not.
    if (seen.has(value)) {
        if (verbose) {
            console.warn('[JQHTML Cache] Circular reference detected - cannot serialize');
        }
        return undefined; // Fail entire serialization
    }
    seen.add(value);

    try {
        // Handle arrays
        if (Array.isArray(value)) {
            const result: any[] = [];
            for (let i = 0; i < value.length; i++) {
                const item = value[i];
                const processed = process_for_serialization(item, verbose, seen);
                // For arrays, we keep undefined as null to preserve indices
                result.push(processed === undefined ? null : processed);
            }
            return result;
        }

        // Handle Date objects specially
        if (value instanceof Date) {
            return {
                [CLASS_MARKER]: 'Date',
                [PROPS_MARKER]: value.toISOString()
            };
        }

        // Handle Map objects
        if (value instanceof Map) {
            const entries: [any, any][] = [];
            for (const [k, v] of value) {
                const processedKey = process_for_serialization(k, verbose, seen);
                const processedValue = process_for_serialization(v, verbose, seen);
                entries.push([processedKey, processedValue]);
            }
            return {
                [CLASS_MARKER]: 'Map',
                [PROPS_MARKER]: entries
            };
        }

        // Handle Set objects
        if (value instanceof Set) {
            const items: any[] = [];
            for (const item of value) {
                items.push(process_for_serialization(item, verbose, seen));
            }
            return {
                [CLASS_MARKER]: 'Set',
                [PROPS_MARKER]: items
            };
        }

        // Get the constructor
        const ctor = value.constructor;

        // Handle registered class instances
        if (ctor && ctor.name && class_registry[ctor.name]) {
            const props: Record<string, any> = {};

            // Extract own enumerable properties (bypass any toJSON method)
            for (const key of Object.keys(value)) {
                const propValue = value[key];
                const processed = process_for_serialization(propValue, verbose, seen);
                // Only include if not undefined (failed serialization)
                if (processed !== undefined || propValue === undefined) {
                    props[key] = processed;
                }
            }

            return {
                [CLASS_MARKER]: ctor.name,
                [PROPS_MARKER]: props
            };
        }

        // Handle plain objects (constructor is Object or no constructor)
        if (ctor === Object || ctor === undefined || ctor === null) {
            const result: Record<string, any> = {};

            for (const key of Object.keys(value)) {
                const propValue = value[key];
                const processed = process_for_serialization(propValue, verbose, seen);
                // Only include if not undefined (unless original was undefined)
                if (processed !== undefined || propValue === undefined) {
                    result[key] = processed;
                }
            }

            return result;
        }

        // Unregistered class instance - convert to plain object for hot/cold parity
        // This ensures developers catch missing class registrations during development
        // (methods will be lost, only properties preserved)
        if (verbose) {
            console.warn(
                `[JQHTML Cache] Converting unregistered class "${ctor.name}" to plain object. ` +
                `Methods will be lost. Call jqhtml.register_cache_class(${ctor.name}) to preserve the class.`
            );
        }

        // Convert to plain object - properties are preserved, prototype methods are lost
        const result: Record<string, any> = {};

        for (const key of Object.keys(value)) {
            const propValue = value[key];
            const processed = process_for_serialization(propValue, verbose, seen);
            // Only include if not undefined (unless original was undefined)
            if (processed !== undefined || propValue === undefined) {
                result[key] = processed;
            }
        }

        return result;
    } finally {
        // Pop this object off the ancestor path now that its subtree is done.
        seen.delete(value);
    }
}

// ============================================================================
// Deserialization (String → Object)
// ============================================================================

/**
 * Deserialize a JSON string, restoring ES6 class instances.
 * Returns null if deserialization fails.
 *
 * @param str - The JSON string to deserialize
 * @param verbose - Whether to log warnings
 * @returns Deserialized value with class instances restored, or null if failed
 */
function deserialize_value(str: string, verbose: boolean): any | null {
    try {
        const parsed = JSON.parse(str);
        return process_for_deserialization(parsed, verbose);
    } catch (e) {
        if (verbose) {
            console.warn('[JQHTML Cache] Deserialization failed:', e);
        }
        return null;
    }
}

/**
 * Recursively process a parsed value, restoring class instances.
 *
 * @param value - The parsed value to process
 * @param verbose - Whether to log warnings
 * @returns Processed value with class instances restored
 */
function process_for_deserialization(value: any, verbose: boolean): any {
    // Handle primitives and null
    if (value === null || value === undefined || typeof value !== 'object') {
        return value;
    }

    // Handle arrays
    if (Array.isArray(value)) {
        return value.map(item => process_for_deserialization(item, verbose));
    }

    // Check for class marker
    if (value[CLASS_MARKER] !== undefined && value[PROPS_MARKER] !== undefined) {
        const class_name = value[CLASS_MARKER];
        const props = value[PROPS_MARKER];

        // Handle built-in types
        if (class_name === 'Date') {
            return new Date(props);
        }

        if (class_name === 'Map') {
            const map = new Map();
            for (const [k, v] of props) {
                map.set(
                    process_for_deserialization(k, verbose),
                    process_for_deserialization(v, verbose)
                );
            }
            return map;
        }

        if (class_name === 'Set') {
            const set = new Set();
            for (const item of props) {
                set.add(process_for_deserialization(item, verbose));
            }
            return set;
        }

        // Look up registered class
        const klass = class_registry[class_name];
        if (!klass) {
            if (verbose) {
                console.warn(
                    `[JQHTML Cache] Cannot restore class "${class_name}" - not registered. ` +
                    `Data will be returned as plain object. ` +
                    `Call jqhtml.register_cache_class(${class_name}) to restore class instances.`
                );
            }
            // Return as plain object rather than failing completely
            return process_for_deserialization(props, verbose);
        }

        // Create instance without calling constructor and assign properties
        try {
            const instance = Object.create(klass.prototype);
            const processed_props = process_for_deserialization(props, verbose);
            Object.assign(instance, processed_props);
            return instance;
        } catch (e) {
            if (verbose) {
                console.warn(`[JQHTML Cache] Failed to restore class "${class_name}":`, e);
            }
            // Return null to signal cache should be treated as miss
            return null;
        }
    }

    // Plain object - process recursively
    const result: Record<string, any> = {};
    for (const key of Object.keys(value)) {
        result[key] = process_for_deserialization(value[key], verbose);
    }
    return result;
}

// ============================================================================
// Main Storage Class
// ============================================================================

/**
 * Cache mode determines how component data is cached and restored.
 *
 * - 'data': (Recommended) Caches this.data with class-aware serialization.
 *   Requires ES6 classes to be registered via register_cache_class().
 *   On cache hit, this.data is hydrated before first render.
 *
 * - 'html': Caches rendered DOM HTML after children are ready.
 *   Does not require class registration. On cache hit, HTML is injected
 *   directly. Note: this.data is NOT populated during on_render() with
 *   cached HTML - use on_ready() for any DOM manipulation that depends on data.
 */
export type CacheMode = 'data' | 'html';

export class Jqhtml_Local_Storage {
    private static _cache_key: string | null = null;
    /** Versioned scope identity - compared in _validate_scope() to clear on a core upgrade. */
    private static _scope_marker: string | null = null;
    private static _cache_mode: CacheMode = 'data';
    private static _storage_available: boolean | null = null;
    private static _initialized: boolean = false;

    /**
     * Set the cache key and initialize storage
     * Must be called before any get/set operations
     * @param {string} cache_key - Unique identifier for this cache scope
     * @param {CacheMode} cache_mode - Cache strategy: 'data' (default, recommended) or 'html'
     */
    static set_cache_key(cache_key: string, cache_mode: CacheMode = 'data'): void {
        this._cache_key = cache_key;

        // Key SHAPE is a function of the library (see cache-key-serializer.ts), so an
        // upgrade that changes it must invalidate everything persisted under the old shape.
        // Version the SCOPE MARKER rather than the key itself: _validate_scope() already
        // clears every jqhtml key when this value changes, and leaving the per-entry key
        // format alone keeps stored keys readable and avoids repeating the version in each.
        this._scope_marker = `${CORE_VERSION}::${cache_key}`;
        this._cache_mode = cache_mode;
        this._init();
    }

    /**
     * Check if cache key has been set
     * @returns {boolean} True if cache key is configured
     */
    static has_cache_key(): boolean {
        return this._cache_key !== null;
    }

    /**
     * Get the current cache mode
     * @returns {CacheMode} Current cache mode ('data' or 'html')
     */
    static get_cache_mode(): CacheMode {
        return this._cache_mode;
    }

    /**
     * Initialize storage system and validate scope
     * Called automatically after cache key is set
     * @private
     */
    private static _init(): void {
        // Check storage availability
        if (this._storage_available === null) {
            this._storage_available = this._is_storage_available();
        }

        if (!this._storage_available || !this._cache_key) {
            return;
        }

        // Validate scope
        this._validate_scope();
        this._initialized = true;
    }

    /**
     * Check if localStorage is available
     * @returns {boolean}
     * @private
     */
    private static _is_storage_available(): boolean {
        try {
            const storage = window.localStorage;
            const test = '__jqhtml_storage_test__';
            storage.setItem(test, test);
            storage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Check if verbose mode is enabled
     * @private
     */
    private static _is_verbose(): boolean {
        return (window as any).jqhtml?.debug?.verbose === true;
    }

    /**
     * Validate storage scope and clear JQHTML keys if cache key changed
     * Only clears keys prefixed with 'jqhtml::' to preserve other libraries' data
     * @private
     */
    private static _validate_scope(): void {
        if (!this._storage_available) {
            return;
        }

        try {
            const stored_key = localStorage.getItem('_jqhtml_cache_key');

            // If the scope marker (core version + developer key) changed, clear only JQHTML keys
            if (stored_key !== null && stored_key !== this._scope_marker) {
                console.log('[JQHTML Local Storage] Cache scope changed, clearing JQHTML keys:', {
                    old_key: stored_key,
                    new_key: this._scope_marker,
                });
                this._clear_jqhtml_keys();
                localStorage.setItem('_jqhtml_cache_key', this._scope_marker!);
            } else if (stored_key === null) {
                // First time JQHTML is using this storage - just set the key, don't clear
                console.log('[JQHTML Local Storage] Initializing cache scope (first use):', {
                    new_key: this._scope_marker,
                });
                localStorage.setItem('_jqhtml_cache_key', this._scope_marker!);
            }
        } catch (e) {
            console.error('[JQHTML Local Storage] Failed to validate scope:', e);
        }
    }

    /**
     * Clear only JQHTML keys from storage (keys starting with 'jqhtml::')
     * Preserves keys from other libraries
     * @private
     */
    private static _clear_jqhtml_keys(): void {
        if (!this._storage_available) {
            return;
        }

        const keys_to_remove: string[] = [];

        // Collect all JQHTML keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('jqhtml::')) {
                keys_to_remove.push(key);
            }
        }

        // Remove collected keys
        keys_to_remove.forEach(key => {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                console.error('[JQHTML Local Storage] Failed to remove key:', key, e);
            }
        });

        console.log(`[JQHTML Local Storage] Cleared ${keys_to_remove.length} JQHTML keys`);
    }

    /**
     * Build scoped key with JQHTML namespace prefix
     * @param {string} key - Developer-provided key
     * @returns {string}
     * @private
     */
    private static _build_key(key: string): string {
        return `jqhtml::${key}::${this._cache_key}`;
    }

    /**
     * Check if storage is ready for use
     * @returns {boolean}
     * @private
     */
    private static _is_ready(): boolean {
        return this._storage_available === true && this._cache_key !== null && this._initialized;
    }

    /**
     * Set item in localStorage with class-aware serialization.
     *
     * If serialization fails (e.g., unregistered class instances, circular refs),
     * the existing cache entry is removed and nothing is stored.
     *
     * @param {string} key - Storage key
     * @param {*} value - Value to store (primitives, objects, arrays, or registered class instances)
     */
    static set(key: string, value: any): void {
        if (!this._is_ready()) {
            return;
        }

        const verbose = this._is_verbose();
        const scoped_key = this._build_key(key);

        // Serialize with class-aware processing
        const serialized = serialize_value(value, verbose);

        if (serialized === null) {
            // Serialization failed - remove any existing cache entry
            if (verbose) {
                console.warn(
                    `[JQHTML Cache] Failed to serialize value for key "${key}". ` +
                    `Removing existing cache entry if present.`
                );
            }
            try {
                localStorage.removeItem(scoped_key);
            } catch (e) {
                // Ignore removal errors
            }
            return;
        }

        // Check size before attempting to store (1MB limit)
        const size_bytes = new Blob([serialized]).size;
        const size_mb = size_bytes / (1024 * 1024);

        if (size_mb > 1) {
            if (verbose) {
                console.warn(
                    `[JQHTML Cache] Skipping set - value too large (${size_mb.toFixed(2)}MB > 1MB limit)`,
                    { key, size_bytes, size_mb }
                );
            }
            // Remove existing cache entry since we can't update it
            try {
                localStorage.removeItem(scoped_key);
            } catch (e) {
                // Ignore removal errors
            }
            return;
        }

        this._set_item(key, serialized);
    }

    /**
     * Get item from localStorage with class-aware deserialization.
     *
     * If deserialization fails, returns null (as if no cache exists).
     *
     * @param {string} key - Storage key
     * @returns {*|null} Deserialized value with class instances restored, or null if not found/failed
     */
    static get(key: string): any | null {
        if (!this._is_ready()) {
            return null;
        }

        const verbose = this._is_verbose();
        const scoped_key = this._build_key(key);

        try {
            const serialized = localStorage.getItem(scoped_key);
            if (serialized === null) {
                return null;
            }

            const result = deserialize_value(serialized, verbose);

            if (result === null) {
                // Deserialization failed - treat as cache miss
                if (verbose) {
                    console.warn(
                        `[JQHTML Cache] Failed to deserialize value for key "${key}". ` +
                        `Treating as cache miss.`
                    );
                }
                return null;
            }

            return result;
        } catch (e) {
            if (verbose) {
                console.warn('[JQHTML Cache] Failed to get item:', e);
            }
            return null;
        }
    }

    /**
     * Remove item from localStorage
     * @param {string} key - Storage key
     */
    static remove(key: string): void {
        if (!this._is_ready()) {
            return;
        }

        this._remove_item(key);
    }

    /**
     * Perform a serialize/deserialize round-trip on a value.
     *
     * This ensures "hot" data (fresh from on_load) behaves identically to "cold" data
     * (restored from cache). Unregistered class instances will be converted to plain
     * objects, exactly as they would be if restored from cache.
     *
     * Use this to normalize data after on_load() so developers catch missing class
     * registrations immediately rather than only after a page reload.
     *
     * @param {any} value - The value to normalize
     * @returns {any} The value after serialize/deserialize round-trip, or original if serialization fails
     */
    static normalize_for_cache(value: any): any {
        const verbose = this._is_verbose();

        // Serialize to JSON string
        const serialized = serialize_value(value, verbose);

        if (serialized === null) {
            // Serialization failed completely - return original
            // (This happens with circular references or other fatal issues)
            if (verbose) {
                console.warn(
                    '[JQHTML Cache] normalize_for_cache: Serialization failed, returning original value'
                );
            }
            return value;
        }

        // Deserialize back to object
        const deserialized = deserialize_value(serialized, verbose);

        if (deserialized === null) {
            // Deserialization failed - return original
            if (verbose) {
                console.warn(
                    '[JQHTML Cache] normalize_for_cache: Deserialization failed, returning original value'
                );
            }
            return value;
        }

        return deserialized;
    }

    /**
     * Internal set implementation with scope validation and quota handling
     * @param {string} key
     * @param {string} serialized - Pre-serialized JSON string
     * @private
     */
    private static _set_item(key: string, serialized: string): void {
        // Validate scope before every write
        this._validate_scope();

        const scoped_key = this._build_key(key);

        try {
            localStorage.setItem(scoped_key, serialized);
        } catch (e: any) {
            // Check if quota exceeded
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.warn('[JQHTML Local Storage] Quota exceeded, clearing JQHTML keys and retrying');

                // Clear only JQHTML keys and retry once
                this._clear_jqhtml_keys();
                localStorage.setItem('_jqhtml_cache_key', this._cache_key!);

                try {
                    localStorage.setItem(scoped_key, serialized);
                } catch (retry_error) {
                    console.error('[JQHTML Local Storage] Failed to set item after clearing JQHTML keys:', retry_error);
                }
            } else {
                console.error('[JQHTML Local Storage] Failed to set item:', e);
            }
        }
    }

    /**
     * Internal remove implementation
     * @param {string} key
     * @private
     */
    private static _remove_item(key: string): void {
        const scoped_key = this._build_key(key);

        try {
            localStorage.removeItem(scoped_key);
        } catch (e) {
            console.error('[JQHTML Local Storage] Failed to remove item:', e);
        }
    }
}
