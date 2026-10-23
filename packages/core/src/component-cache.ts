/**
 * JQHTML Component Cache Integration
 *
 * Extracted from component.ts - handles cache key generation,
 * cache reads during create(), cache checks during reload(),
 * and HTML cache snapshots during ready() and reload().
 *
 * Uses Jqhtml_Local_Storage as the underlying storage layer.
 */

import { Load_Coordinator } from './load-coordinator.js';
import { Jqhtml_Local_Storage } from './local-storage.js';
import { warn_uncacheable_args_enabled } from './config.js';

/**
 * Result of generating a cache key for a component.
 */
interface Cache_Key_Result {
  cache_key: string | null;
  uncacheable_property?: string;
  uncacheable_reason?: string;
}

/**
 * Generate a cache key for a component using its name + args.
 * Supports custom cache_id() override.
 *
 * @param component - The component instance
 * @returns Cache key string or null if caching is disabled
 */
export function generate_cache_key(component: any): Cache_Key_Result {
  if (typeof component.cache_id === 'function') {
    try {
      const custom_cache_id = component.cache_id();
      return { cache_key: `${component.component_name()}::${String(custom_cache_id)}` };
    } catch (error) {
      return { cache_key: null, uncacheable_property: 'cache_id()', uncacheable_reason: 'cache-id-threw' };
    }
  }

  // Standard args-based key. The CACHE opts into content serialization for plain-data
  // object args; deduplication does not - see InvocationKeyOptions for why.
  const result = Load_Coordinator.generate_invocation_key(
    component.component_name(),
    component.args,
    { allow_content_serialization: true }
  );
  return {
    cache_key: result.key,
    uncacheable_property: result.uncacheable_property,
    uncacheable_reason: result.uncacheable_reason,
  };
}

// One warning per component+property. A list of 50 rows must not print 50 warnings.
const _warned_uncacheable = new Set<string>();

/**
 * Development warning: this component fetches data but cannot be cached, because
 * its args do not reduce to a stable key and it defines no cache_id() to say what
 * its identity is. Nothing is broken - the component works - but it silently opts
 * out of cache reuse and of load deduplication.
 *
 * Controlled by the `warn_uncacheable_args` integration flag (see config.ts).
 */
export function warn_uncacheable_component(
  component: any,
  uncacheable_property?: string,
  uncacheable_reason?: string
): void {
  if (!warn_uncacheable_args_enabled()) return;

  let name = 'unknown';
  try { name = component.component_name(); } catch { /* name unavailable */ }

  const dedupe_key = `${name}::${uncacheable_property || '?'}::${uncacheable_reason || '?'}`;
  if (_warned_uncacheable.has(dedupe_key)) return;
  _warned_uncacheable.add(dedupe_key);

  // cache_id() exists but threw - a different problem with a different fix
  if (uncacheable_property === 'cache_id()' || uncacheable_reason === 'cache-id-threw') {
    console.warn(
      `[JQHTML] <${name}> defines cache_id() but it threw, so this component is not cached ` +
      `and its loads are not deduplicated. Fix cache_id() so it returns a stable string.`,
      { component: name, cid: component._cid }
    );
    return;
  }

  const REASONS: Record<string, string> = {
    'function': 'it contains a function - a callback is real identity that content cannot express',
    'symbol': 'it contains a symbol',
    'bigint': 'it contains a bigint',
    'dom-node': 'it contains a DOM node',
    'jquery': 'it contains a jQuery object',
    'circular': 'it contains a circular reference',
    'non-plain-object': 'it contains a class instance, Map, Set or similar - only plain objects and arrays can be keyed by content',
    'too-large': 'it serializes to more than 500 bytes - args are meant to identify data, not carry it',
    'invalid-date': 'it contains an invalid Date',
  };
  const why = REASONS[uncacheable_reason || ''] || 'it cannot be serialized deterministically';

  console.warn(
    `[JQHTML] <${name}> cannot be cached: arg $${uncacheable_property} is not keyable because ` +
    `${why}.\n` +
    `  The component works, but it will not be restored from cache when reused.\n` +
    `  Fix: define cache_id() on the component to state its identity explicitly, e.g.\n` +
    `    cache_id() { return \`${name.toLowerCase()}_\${this.args.some_id}\`; }\n` +
    `  Or pass plain data (objects/arrays of primitives are keyed automatically) instead of ` +
    `$${uncacheable_property}.\n` +
    `  Find it in DevTools with the selector ` +
    `[data-nocache="${uncacheable_property}:${uncacheable_reason || ''}"].`,
    {
      component: name,
      cid: component._cid,
      uncacheable_arg: uncacheable_property,
      reason: uncacheable_reason,
      all_args: component.args ? Object.keys(component.args) : [],
    }
  );
}

/**
 * Keep the element's `data-nocache` marker in step with a cache key result. Boot,
 * `load()` and `reload()` all call this with the key they just computed, so the marker
 * always describes the CURRENT args:
 *
 *   key        - remove any `data-nocache` (args that were unkeyable are keyable again)
 *   no key     - `data-nocache="<arg>:<reason>"`, plus the dev warning when `warn` is set
 *                (itself gated by `warn_uncacheable_args`, once per component+arg+reason)
 */
export function mark_cacheability(component: any, result: Cache_Key_Result, warn: boolean = true): void {
  const { cache_key, uncacheable_property, uncacheable_reason } = result;
  if (cache_key !== null) {
    component.$.removeAttr('data-nocache');
    return;
  }

  if (uncacheable_property) {
    // "<arg>:<reason>" - a bare property name left authors reverse-engineering why
    component.$.attr(
      'data-nocache',
      uncacheable_reason ? `${uncacheable_property}:${uncacheable_reason}` : uncacheable_property
    );
  }

  if (warn) {
    warn_uncacheable_component(component, uncacheable_property, uncacheable_reason);
  }
}

/**
 * An HTML-cache entry: the inner HTML of a component plus the cid it was rendered
 * under. Scoped ids inside the markup are "<name>:<cid>", so the owner's cid is what
 * lets a replaying instance tell its own elements from its children's.
 */
export interface Html_Cache_Snapshot {
  cid: string;
  html: string;
}

/**
 * Read an HTML-cache entry, rejecting anything that is not a well-formed snapshot.
 * Entries written by an older core are bare strings. They are never looked up (entry keys
 * carry the core version), and the versioned scope marker clears them on the next version
 * bump; the shape check below is a second guard.
 */
function read_html_snapshot(html_cache_key: string): Html_Cache_Snapshot | null {
  const entry = Jqhtml_Local_Storage.get(html_cache_key);
  if (
    entry !== null &&
    typeof entry === 'object' &&
    typeof entry.cid === 'string' &&
    typeof entry.html === 'string'
  ) {
    return entry as Html_Cache_Snapshot;
  }
  return null;
}

/**
 * Read cache during create() phase.
 * Sets component._cache_key, _cached_html, _use_cached_data_hit as side effects.
 *
 * @param component - The component instance
 */
export function read_cache_in_create(component: any): void {
  const key_result = generate_cache_key(component);
  const { cache_key, uncacheable_property } = key_result;

  // Set or clear data-nocache (and warn) for debugging
  mark_cacheability(component, key_result);

  // If cache_key is null, caching disabled
  if (cache_key === null) {
    if ((window as any).jqhtml?.debug?.verbose) {
      console.log(
        `[Cache] Component ${component._cid} (${component.component_name()}) has non-serializable args - caching disabled`,
        { uncacheable_property }
      );
    }
    return;
  }

  // Store cache key for later use
  component._cache_key = cache_key;

  // skip_cache_read, or no layout box (display:none on it or an ancestor): a cached
  // first paint nobody can see is wasted work, so boot exactly as on a miss. The key
  // above is kept for the writes. The visibility test forces layout, so it is made only
  // when a cache is configured.
  if (component._skip_cache_read ||
      (Jqhtml_Local_Storage.has_cache_key() && !component.$.is(':visible'))) {
    if ((window as any).jqhtml?.debug?.verbose) {
      console.log(
        `[Cache] Component ${component._cid} (${component.component_name()}) skipping cache read in create()`,
        { cache_key, reason: component._skip_cache_read ? 'skip_cache_read' : 'not visible' }
      );
    }
    return;
  }

  // Get cache mode
  const cache_mode = Jqhtml_Local_Storage.get_cache_mode();

  if ((window as any).jqhtml?.debug?.verbose) {
    console.log(
      `[Cache ${cache_mode}] Component ${component._cid} (${component.component_name()}) checking cache in create()`,
      { cache_key, cache_mode, has_cache_key_set: Jqhtml_Local_Storage.has_cache_key() }
    );
  }

  if (cache_mode === 'html') {
    // HTML cache mode - check for cached HTML to inject on first render
    const html_cache_key = `${cache_key}::html`;
    const cached_html = read_html_snapshot(html_cache_key);
    if (cached_html !== null) {
      component._cached_html = cached_html;

      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Cache html] Component ${component._cid} (${component.component_name()}) found cached HTML`,
          { cache_key: html_cache_key, html_length: cached_html.html.length, snapshot_cid: cached_html.cid }
        );
      }
    } else {
      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Cache html] Component ${component._cid} (${component.component_name()}) cache miss`,
          { cache_key: html_cache_key }
        );
      }
    }

    // Warn if use_cached_data is set in html cache mode
    if (component.args.use_cached_data === true) {
      console.warn(
        `[JQHTML] Component "${component.component_name()}" has use_cached_data=true but cache mode is 'html'.\n` +
        `use_cached_data only applies to 'data' cache mode. In 'html' mode, the entire rendered HTML is cached.\n` +
        `The use_cached_data flag will be ignored.`
      );
    }
  } else {
    // Data cache mode (default) - check for cached data to hydrate this.data
    const cached_data = Jqhtml_Local_Storage.get(cache_key);
    if (cached_data !== null && typeof cached_data === 'object') {
      // Hydrate this.data with cached data
      component.data = cached_data;
      component._data_cache_key = cache_key;

      if (component.args.use_cached_data === true) {
        component._use_cached_data_hit = true;

        if ((window as any).jqhtml?.debug?.verbose) {
          console.log(
            `[Cache data] Component ${component._cid} (${component.component_name()}) using cached data (use_cached_data=true, skipping on_load)`,
            { cache_key, data: cached_data }
          );
        }
      } else {
        if ((window as any).jqhtml?.debug?.verbose) {
          console.log(
            `[Cache data] Component ${component._cid} (${component.component_name()}) hydrated from cache`,
            { cache_key, data: cached_data }
          );
        }
      }
    } else {
      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Cache data] Component ${component._cid} (${component.component_name()}) cache miss`,
          { cache_key }
        );
      }
    }
  }
}

/**
 * Refresh the cache key at the start of every reload(), then - if args have changed -
 * check the cache. On a hit, hydrates data/html and triggers an immediate render.
 *
 * The recomputed key is ALWAYS assigned, null included: every cache write later in the
 * reload (data after on_load(), the html snapshot after render) goes to _cache_key, so
 * a key left over from the previous args would file the new args' content under the
 * old args' entry.
 *
 * @param component - The component instance
 * @param args_changed - Whether this.args differ from the last render's
 * @returns true if rendered from cache, false otherwise
 */
export function check_cache_on_reload(component: any, args_changed: boolean): boolean {
  const key_result = generate_cache_key(component);
  const { cache_key } = key_result;
  component._cache_key = cache_key;

  // The same data-nocache marker and dev warning boot and load() give, for these args.
  mark_cacheability(component, key_result);

  // An instance whose on_load() has ever failed is out of caching for good.
  // skip_cache_read or not visible: no read, the key above is kept for the writes.
  if (!args_changed || cache_key === null || component._load_failed || component._skip_cache_read) {
    return false;
  }
  if (Jqhtml_Local_Storage.has_cache_key() && !component.$.is(':visible')) {
    return false;
  }

  const cache_mode = Jqhtml_Local_Storage.get_cache_mode();

  if (cache_mode === 'html') {
    // HTML cache mode - check for cached HTML
    const html_cache_key = `${cache_key}::html`;
    const cached_html = read_html_snapshot(html_cache_key);

    if (cached_html !== null) {
      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Cache html] reload() - Component ${component._cid} (${component.component_name()}) found cached HTML (args changed)`,
          { cache_key: html_cache_key, html_length: cached_html.html.length, snapshot_cid: cached_html.cid }
        );
      }

      component._cached_html = cached_html;
      // Call _render() directly (not render()) since _reload() manages the full lifecycle
      // Using render() would trigger a separate queue entry and interfere with _reload()'s flow
      component._render();
      return true;
    }
  } else {
    // Data cache mode (default) - check for cached data
    const cached_data = Jqhtml_Local_Storage.get(cache_key);

    if (cached_data !== null && typeof cached_data === 'object' && JSON.stringify(cached_data) !== '{}') {
      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Cache data] reload() - Component ${component._cid} (${component.component_name()}) hydrated from cache (args changed)`,
          { cache_key, data: cached_data }
        );
      }

      // Hydrate this.data with cached data
      component.__data_frozen = false;
      component.data = cached_data;
      component.__data_frozen = true;
      component._data_cache_key = cache_key;

      // Call _render() directly (not render()) since _reload() manages the full lifecycle
      component._render();
      return true;
    }
  }

  return false;
}

/**
 * Write HTML cache snapshot during ready() phase, and at the end of a reload() that
 * loaded changed data. Only caches if the component is dynamic (data changed during
 * on_load).
 *
 * @param component - The component instance
 */
export function write_html_cache_snapshot(component: any): void {
  if (!component._should_cache_html_after_ready || !component._cache_key) {
    return;
  }

  // An instance whose on_load() has ever failed is out of caching for good: its markup
  // may be an on_load_error() fallback.
  if (component._load_failed) {
    component._should_cache_html_after_ready = false;
    return;
  }

  if (component._is_dynamic) {
    component._should_cache_html_after_ready = false;

    const html = component.$.html();
    const html_cache_key = `${component._cache_key}::html`;
    // Store the cid this markup was rendered under alongside it: every scoped id inside
    // reads "<name>:<cid>", and a reader cannot tell the snapshotting component's own
    // elements from its children's without knowing which cid was the owner's.
    // See Jqhtml_Component._rescope_cached_html().
    Jqhtml_Local_Storage.set(html_cache_key, { cid: component._cid, html });

    if ((window as any).jqhtml?.debug?.verbose) {
      console.log(
        `[Cache html] Component ${component._cid} (${component.component_name()}) cached HTML after children on_render complete`,
        { cache_key: html_cache_key, html_length: html.length }
      );
    }
  } else {
    component._should_cache_html_after_ready = false;

    if ((window as any).jqhtml?.debug?.verbose) {
      console.log(
        `[Cache html] Component ${component._cid} (${component.component_name()}) is static (no data change) - skipping HTML cache`
      );
    }
  }
}

/**
 * Write data/HTML to cache after on_load() completes, and set component._is_dynamic.
 * Called from _apply_load_result().
 *
 * A load is written when its data changed to something other than the empty '{}', OR
 * when its data is unchanged but the cache key moved: a reload() with new args whose
 * data equals the previous load's must still file that data under the new key, or a
 * later boot with those args misses. Same key and unchanged data writes nothing.
 * component._data_cache_key is the key the current this.data is cached under (written
 * or hydrated from), null when it is not cached.
 *
 * @param component - The component instance
 * @param data_changed - Whether this.data changed during on_load
 * @param data_text - this.data's serialized text (what it was normalized through)
 */
export function write_cache_on_loaded(component: any, data_changed: boolean, data_text: string): void {
  const cache_key = component._cache_key;
  const key_moved =
    !data_changed &&
    component._data_cache_key !== null &&
    cache_key !== null &&
    cache_key !== component._data_cache_key;

  // Read by write_html_cache_snapshot(): only a load worth writing is snapshotted.
  component._is_dynamic = (data_changed && data_text !== '{}') || key_moved;

  // New data: whatever entry held the old data no longer holds this.data.
  if (data_changed) {
    component._data_cache_key = null;
  }

  // _load_failed: an on_load() of this instance has failed, so the data may be an
  // on_load_error() fallback - and the instance is out of caching for good either way.
  if (!component._is_dynamic || !cache_key || component._load_failed) {
    return;
  }

  component._data_cache_key = cache_key;

  const cache_mode = Jqhtml_Local_Storage.get_cache_mode();

  if (cache_mode === 'html') {
    // HTML cache mode - flag to cache HTML after children render, in _ready() at boot
    // or at the end of _reload()
    component._should_cache_html_after_ready = true;

    if ((window as any).jqhtml?.debug?.verbose) {
      console.log(
        `[Cache html] Component ${component._cid} (${component.component_name()}) will cache HTML after ready`,
        { cache_key: component._cache_key }
      );
    }
  } else {
    // Data cache mode (default) - write this.data to cache. The text this.data was
    // normalized through is its serialized form, so it is stored as-is.
    Jqhtml_Local_Storage.set_serialized(component._cache_key, data_text);

    if ((window as any).jqhtml?.debug?.verbose) {
      console.log(
        `[Cache data] Component ${component._cid} (${component.component_name()}) cached data after on_load()`,
        { cache_key: component._cache_key, data: component.data }
      );
    }
  }
}
