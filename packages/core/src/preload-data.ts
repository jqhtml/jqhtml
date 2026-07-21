/**
 * JQHTML SSR Preload Data System
 *
 * Captures component data during SSR rendering and replays it on the client
 * to skip redundant on_load() calls during hydration.
 *
 * Server-side: start_data_capture() → render → get_captured_data()
 * Client-side: set_preload_data(entries) → components boot with preloaded data → clear_preload_data()
 */

import { Load_Coordinator } from './load-coordinator.js';

// --- Types ---

export interface PreloadEntry {
  component: string;
  args: Record<string, any>;
  data: Record<string, any>;
}

// --- Capture (Server Side) ---

let _capture_enabled = false;
let _capture_buffer: PreloadEntry[] = [];
// Track captured keys to avoid duplicates from Load Coordinator followers
let _captured_keys = new Set<string>();

/**
 * Enable data capture mode. After this call, every component that completes
 * on_load() has its final this.data recorded.
 *
 * Idempotent — calling twice is fine.
 */
export function start_data_capture(): void {
  _capture_enabled = true;
  _capture_buffer = [];
  _captured_keys.clear();
}

/**
 * Record a component's data after on_load() completes.
 * Called internally from _apply_load_result().
 *
 * @param component_name - Component name
 * @param args - Component args at time of on_load()
 * @param data - this.data after on_load() completed
 * @param cache_key - The cache key for deduplication (null = always capture)
 */
export function capture_component_data(
  component_name: string,
  args: Record<string, any>,
  data: Record<string, any>,
  cache_key: string | null
): void {
  if (!_capture_enabled) return;

  // Deduplicate: if Load Coordinator already captured this key, skip
  if (cache_key !== null) {
    if (_captured_keys.has(cache_key)) return;
    _captured_keys.add(cache_key);
  }

  // Deep clone args and data to plain objects (no proxies, no class instances)
  try {
    const cloned_args = JSON.parse(JSON.stringify(args));
    const cloned_data = JSON.parse(JSON.stringify(data));

    _capture_buffer.push({
      component: component_name,
      args: cloned_args,
      data: cloned_data,
    });
  } catch (error) {
    // Non-serializable data — skip capture for this component
    if (typeof console !== 'undefined') {
      console.warn(
        `[JQHTML SSR Capture] Failed to serialize data for ${component_name}:`,
        error
      );
    }
  }
}

/**
 * Returns all captured component data and resets the capture buffer.
 * One-shot: calling clears the buffer.
 */
export function get_captured_data(): PreloadEntry[] {
  const result = _capture_buffer;
  _capture_buffer = [];
  _captured_keys.clear();
  return result;
}

/**
 * Check if data capture is currently enabled.
 */
export function is_capture_enabled(): boolean {
  return _capture_enabled;
}

/**
 * Stop data capture and clear all state.
 */
export function stop_data_capture(): void {
  _capture_enabled = false;
  _capture_buffer = [];
  _captured_keys.clear();
}

// --- Preload (Client Side) ---

let _preload_cache: Map<string, Record<string, any>> = new Map();

/**
 * Seed the preload cache with SSR-captured data.
 * Must be called before any component _load() runs.
 *
 * @param entries - Array of { component, args, data } entries from get_captured_data()
 */
export function set_preload_data(entries: PreloadEntry[] | null): void {
  if (!entries || entries.length === 0) return;

  _preload_cache.clear();

  for (const entry of entries) {
    // Generate key using the same algorithm as Load Coordinator
    const result = Load_Coordinator.generate_invocation_key(entry.component, entry.args);
    if (result.key !== null) {
      _preload_cache.set(result.key, entry.data);
    }
  }
}

/**
 * Check if preloaded data exists for a given cache key.
 * If found, returns the data and removes the entry (one-shot).
 *
 * @param cache_key - The cache key (same format as Load Coordinator)
 * @returns The preloaded data, or null if no match
 */
export function consume_preload_data(cache_key: string): Record<string, any> | null {
  if (_preload_cache.size === 0) return null;

  const data = _preload_cache.get(cache_key);
  if (data !== undefined) {
    _preload_cache.delete(cache_key);
    return data;
  }
  return null;
}

/**
 * Clear any remaining unconsumed preload entries.
 * Call after initial page hydration is complete.
 */
export function clear_preload_data(): void {
  _preload_cache.clear();
}

/**
 * Check if any preload data is available (for fast early exit in _load).
 */
export function has_preload_data(): boolean {
  return _preload_cache.size > 0;
}
