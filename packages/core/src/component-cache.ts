/**
 * JQHTML Component Cache Integration
 *
 * Extracted from component.ts - handles cache key generation,
 * cache reads during create(), cache checks during reload(),
 * and HTML cache snapshots during ready().
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
function warn_uncacheable_component(
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
 * Read cache during create() phase.
 * Sets component._cache_key, _cached_html, _use_cached_data_hit as side effects.
 *
 * @param component - The component instance
 */
export function read_cache_in_create(component: any): void {
  const { cache_key, uncacheable_property, uncacheable_reason } = generate_cache_key(component);

  // If cache_key is null, caching disabled
  if (cache_key === null) {
    // Set data-nocache attribute for debugging
    if (uncacheable_property) {
      // "<arg>:<reason>" - a bare property name left authors reverse-engineering why
      component.$.attr(
        'data-nocache',
        uncacheable_reason ? `${uncacheable_property}:${uncacheable_reason}` : uncacheable_property
      );
    }

    warn_uncacheable_component(component, uncacheable_property, uncacheable_reason);

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
    const cached_html = Jqhtml_Local_Storage.get(html_cache_key);
    if (cached_html !== null && typeof cached_html === 'string') {
      component._cached_html = cached_html;

      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Cache html] Component ${component._cid} (${component.component_name()}) found cached HTML`,
          { cache_key: html_cache_key, html_length: cached_html.length }
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
 * Check cache during reload() when args have changed.
 * If cache hit, hydrates data/html and triggers an immediate render.
 *
 * @param component - The component instance
 * @returns true if rendered from cache, false otherwise
 */
export function check_cache_on_reload(component: any): boolean {
  const { cache_key } = generate_cache_key(component);

  if (cache_key === null) {
    return false;
  }

  const cache_mode = Jqhtml_Local_Storage.get_cache_mode();
  component._cache_key = cache_key;

  if (cache_mode === 'html') {
    // HTML cache mode - check for cached HTML
    const html_cache_key = `${cache_key}::html`;
    const cached_html = Jqhtml_Local_Storage.get(html_cache_key);

    if (cached_html !== null && typeof cached_html === 'string') {
      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Cache html] reload() - Component ${component._cid} (${component.component_name()}) found cached HTML (args changed)`,
          { cache_key: html_cache_key, html_length: cached_html.length }
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

      // Call _render() directly (not render()) since _reload() manages the full lifecycle
      component._render();
      return true;
    }
  }

  return false;
}

/**
 * Write HTML cache snapshot during ready() phase.
 * Only caches if the component is dynamic (data changed during on_load).
 *
 * @param component - The component instance
 */
export function write_html_cache_snapshot(component: any): void {
  if (!component._should_cache_html_after_ready || !component._cache_key) {
    return;
  }

  if (component._is_dynamic) {
    component._should_cache_html_after_ready = false;

    const html = component.$.html();
    const html_cache_key = `${component._cache_key}::html`;
    Jqhtml_Local_Storage.set(html_cache_key, html);

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
 * Write data/HTML to cache after on_load() completes.
 * Called from _apply_load_result().
 *
 * @param component - The component instance
 * @param data_changed - Whether this.data changed during on_load
 */
export function write_cache_on_loaded(component: any, data_changed: boolean): void {
  if (!data_changed || !component._cache_key) {
    return;
  }

  const cache_mode = Jqhtml_Local_Storage.get_cache_mode();

  if (cache_mode === 'html') {
    // HTML cache mode - flag to cache HTML after children ready in _ready()
    component._should_cache_html_after_ready = true;

    if ((window as any).jqhtml?.debug?.verbose) {
      console.log(
        `[Cache html] Component ${component._cid} (${component.component_name()}) will cache HTML after ready`,
        { cache_key: component._cache_key }
      );
    }
  } else {
    // Data cache mode (default) - write this.data to cache
    Jqhtml_Local_Storage.set(component._cache_key, component.data);

    if ((window as any).jqhtml?.debug?.verbose) {
      console.log(
        `[Cache data] Component ${component._cid} (${component.component_name()}) cached data after on_load()`,
        { cache_key: component._cache_key, data: component.data }
      );
    }
  }
}
