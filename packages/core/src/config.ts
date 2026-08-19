/**
 * JQHTML Runtime Configuration
 *
 * Integration-level settings supplied by the host application (RSpade, Laravel,
 * a bundler entry point) when jqhtml is loaded. Distinct from `jqhtml.debug`,
 * which is a developer's interactive tracing switch: config here describes the
 * ENVIRONMENT the app is running in, and jqhtml derives behaviour from it.
 *
 *   jqhtml.init($, { mode: 'production' });
 *   jqhtml.configure({ mode: 'development' });
 *
 * Default mode is 'development', so an integration that passes nothing keeps
 * every diagnostic. Production is always opt-in.
 */

export type Jqhtml_Mode = 'development' | 'production';

export interface Jqhtml_Config {
  /** Environment the host app is running in. Sets defaults for every flag below. */
  mode?: Jqhtml_Mode;

  /**
   * Warn when a component that fetches data is invoked with args that cannot be
   * serialized into a cache key, and defines no cache_id() to compensate.
   * Default: on in development, off in production.
   */
  warn_uncacheable_args?: boolean;

  /**
   * Emit debug-only DOM attributes. Both of the ones jqhtml renders exist purely
   * for DevTools legibility; the runtime reads neither.
   *
   *   data-sid  mirrors the scoped `id="<sid>:<cid>"` that $sid() resolves against
   *   data-cid  mirrors the component's `_cid`, marking component boundaries
   *
   * Default: on in development, off in production.
   *
   * NOTE: the instruction processor also writes a TRANSIENT `data-cid` into the
   * generated HTML string to correlate each node with its JS-side component data.
   * That one is functional and is never suppressed - it is matched and removed
   * during rendering, before the debug attribute above is ever written.
   */
  debug_attributes?: boolean;
}

/** Flags implied by each mode. Add future conventions here, not at call sites. */
const MODE_DEFAULTS: Record<Jqhtml_Mode, Required<Omit<Jqhtml_Config, 'mode'>>> = {
  development: {
    warn_uncacheable_args: true,
    debug_attributes: true,
  },
  production: {
    warn_uncacheable_args: false,
    debug_attributes: false,
  },
};

let _mode: Jqhtml_Mode = 'development';
let _flags: Required<Omit<Jqhtml_Config, 'mode'>> = { ...MODE_DEFAULTS.development };

/**
 * Apply integration configuration.
 *
 * `mode` resets every flag to that mode's defaults; any explicit flag in the
 * same call then overrides it. Calling with only flags leaves the mode alone.
 * Repeated calls merge.
 */
export function configure(config: Jqhtml_Config | undefined | null): void {
  if (!config) return;

  if (config.mode) {
    if (!MODE_DEFAULTS[config.mode]) {
      throw new Error(
        `[JQHTML] Unknown mode '${config.mode}'. Expected 'development' or 'production'.`
      );
    }
    _mode = config.mode;
    _flags = { ...MODE_DEFAULTS[config.mode] };
  }

  if (config.warn_uncacheable_args !== undefined) {
    _flags.warn_uncacheable_args = !!config.warn_uncacheable_args;
  }
  if (config.debug_attributes !== undefined) {
    _flags.debug_attributes = !!config.debug_attributes;
  }
}

/** Current mode plus every resolved flag. */
export function get_config(): Jqhtml_Config & { mode: Jqhtml_Mode } {
  return { mode: _mode, ..._flags };
}

/** True when debug-only DOM attributes (data-sid) should be emitted. */
export function debug_attributes_enabled(): boolean {
  return _flags.debug_attributes;
}

/** True when uncacheable-args warnings should be printed. */
export function warn_uncacheable_args_enabled(): boolean {
  return _flags.warn_uncacheable_args;
}
