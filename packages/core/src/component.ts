/**
 * JQHTML v2 Component Base Class
 * 
 * Core component implementation following v2 specification:
 * - 5-stage lifecycle coordinated by LifecycleManager
 * - Direct jQuery manipulation (no virtual DOM)
 * - Scoped IDs using _cid pattern
 * - Event emission and CSS class hierarchy
 */

// Use global jQuery
declare const $: any;
import { LifecycleManager } from './lifecycle-manager.js';
import { get_template_by_class, get_template, get_component_class, extends_conflict } from './component-registry.js';
import { process_instructions, uid } from './instruction-processor.js';
import { logLifecycle, applyDebugDelay, handleComponentError } from './debug.js';
import { Load_Coordinator } from './load-coordinator.js';
import { Jqhtml_Local_Storage, is_registered_cache_class_instance } from './local-storage.js';
import { event_on, event_once, event_trigger, event_on_registered, event_invalidate } from './component-events.js';
import { setup_data_property, execute_on_load_detached, execute_on_load_error_detached, LOAD_HOOK_OWNER, RAW_DATA } from './data-proxy.js';
import { track_attachment, untrack_attachment } from './dom-attachment.js';
import { read_cache_in_create, check_cache_on_reload, write_html_cache_snapshot, write_cache_on_loaded, generate_cache_key, mark_cacheability } from './component-cache.js';
import { debug_attributes_enabled, get_config } from './config.js';
import { COMPONENT_NAME_PATTERN, is_component_name, dynamic_component_name } from './component-name.js';
import { print_object } from './value-printers.js';
import { escape_html, escape_html_nl2br } from './escape.js';
import { Jqhtml_Markup, markup_has_content } from './markup.js';

/**
 * The `jqhtml` argument every compiled render function receives: the markup
 * buffer class each render/content/slot function returns, the same escaping
 * the runtime exports, the object-printer entry point, and the dynamic tag
 * name check. One shared object, not one per render.
 */
export const render_utilities = {
  Markup: Jqhtml_Markup,
  escape_html,
  escape_html_nl2br,
  print_object,
  dynamic_component_name,
};
import { Component_Queue, Lifecycle_Call_Promise } from './component-queue.js';
import { capture_component_data, is_capture_enabled, consume_preload_data, has_preload_data } from './preload-data.js';
import { get_viewport_width } from './viewport.js';
import { merge_style } from './style-merge.js';

// The base get_class_hierarchy() result per class, for _apply_css_classes(). A class's
// name and prototype chain do not change after definition, and re-registering a class
// registers a new class object, so no entry goes stale. A class that overrides the
// static method (or has it patched) is asked every time, as before. Read-only: the
// caller copies before adding to it.
const class_hierarchies = new WeakMap<object, string[]>();
function class_hierarchy_of(ctor: typeof Jqhtml_Component): string[] {
  if (ctor.get_class_hierarchy !== base_get_class_hierarchy) return ctor.get_class_hierarchy();
  let hierarchy = class_hierarchies.get(ctor);
  if (hierarchy === undefined) {
    hierarchy = ctor.get_class_hierarchy();
    class_hierarchies.set(ctor, hierarchy);
  }
  return hierarchy;
}

// Lifecycle methods guarded against manual calls, with the hint each error gives.
// The wrapper itself stays per instance: it closes over its own component, so a call
// with any other `this` (or none) still names that component in the error.
const PROTECTED_LIFECYCLE_METHODS: ReadonlyArray<readonly [string, string]> = [
  ['on_create', 'Called automatically during creation.'],
  ['on_render', 'Use render() to trigger a re-render.'],
  ['on_load', 'Use reload() to refresh data.'],
  ['on_load_error', 'Called automatically when on_load() fails.'],
  ['on_ready', 'Called automatically when ready.'],
  ['on_stop', 'Use stop() to stop the component.'],
  ['on_attach', 'Called automatically when the component enters the document.'],
  ['on_detach', 'Called automatically when the component leaves the document.'],
];

// WeakMap storage for protected lifecycle method implementations (Option 2)
// See docs/internal/lifecycle-method-protection.md for design details
const lifecycle_impls = new WeakMap<Jqhtml_Component, Record<string, Function>>();

/**
 * Resolve the template a template inherits FROM, in the one order CLAUDE.md
 * documents ("Template Inheritance Resolution"): the explicit `extends=""`
 * attribute first, then the JS class prototype chain.
 *
 * This is the single implementation. Both slot-only rendering (which invokes the
 * parent template with the child's slots) and default-attribute collection walk
 * it, so a `<Define>`'s class/attrs can never resolve through a different chain
 * than its markup does.
 *
 * It does not judge whether extends="" agrees with the JS class: _render() throws on
 * a conflict first (extends_conflict() in component-registry.ts).
 *
 * @param template_def The template whose parent is wanted
 * @param ctor The component class to walk the prototype chain of (null skips it)
 * @returns The parent template and the name it was found under, or null
 */
function resolve_parent_template(
  template_def: any,
  ctor: any
): { template: any; name: string } | null {
  const verbose = (window as any).jqhtml?.debug?.verbose;

  // 1. Explicit extends="" wins - the author said exactly which template to use.
  if (template_def?.extends) {
    const parent = get_template(template_def.extends);
    // get_template() never returns null: a miss yields DEFAULT_TEMPLATE, whose
    // name is 'Jqhtml_Component'. That is "not found", not a parent.
    if (parent && parent.name !== 'Jqhtml_Component') {
      if (verbose) console.log(`[JQHTML] resolve_parent_template: explicit extends -> ${template_def.extends}`);
      return { template: parent, name: template_def.extends };
    }
    if (verbose) console.log(`[JQHTML] resolve_parent_template: extends="${template_def.extends}" has no template`);
  }

  // 2. Otherwise walk the JS prototype chain for the nearest ancestor with a template.
  // Stop at the framework base, at Object, and at Function.prototype (name === ''),
  // which is what getPrototypeOf() hands back once the class chain is exhausted.
  let current_class = ctor ? Object.getPrototypeOf(ctor) : null;
  while (typeof current_class === 'function' && current_class.name &&
         current_class.name !== 'Object' && current_class.name !== 'Jqhtml_Component') {
    const class_name = current_class.name;

    // Internal base classes are aliases of Jqhtml_Component, never a parent template.
    if (class_name !== '_Jqhtml_Component' && class_name !== '_Base_Jqhtml_Component') {
      const class_template = get_template(class_name);
      if (class_template && class_template.name !== 'Jqhtml_Component' && class_template !== template_def) {
        if (verbose) console.log(`[JQHTML] resolve_parent_template: prototype chain -> ${class_name}`);
        return { template: class_template, name: class_name };
      }
    }

    current_class = Object.getPrototypeOf(current_class);
  }

  return null;
}

/**
 * The template chain a component's defaults come from, FARTHEST ancestor first and
 * the component's own template last. Walks resolve_parent_template(), so extends=
 * and the JS prototype chain (slot-only JS subclasses included) are followed exactly
 * as the render path follows them.
 *
 * The one walk both kinds of <Define> default use: `$foo` arg defaults (defineArgs,
 * see merge_define_args()) and attribute defaults (_apply_default_attributes()).
 *
 * @param template The component's own template
 * @param ctor The component class (its prototype chain is walked)
 */
function resolve_template_chain(template: any, ctor: any): any[] {
  const chain: any[] = [];
  let current_template = template;
  let current_class: any = ctor;
  const seen = new Set<any>();

  while (current_template && !seen.has(current_template)) {
    seen.add(current_template);
    chain.unshift(current_template); // Add to front so the farthest ancestor comes first

    const parent = resolve_parent_template(current_template, current_class);
    if (!parent) break;

    current_template = parent.template;
    // Advance the prototype walk too: the next parent must be resolved relative to
    // the class we just landed on, not the original one. A template-only parent has
    // no class, which is correct - its own chain can only be an explicit extends=.
    current_class = get_component_class(parent.name) || null;
  }

  return chain;
}

/**
 * Merge the `$foo` arg defaults (defineArgs) of a template chain, nearest template
 * winning: farthest ancestor < nearer ancestors < the component's own template.
 *
 * A `$foo` arg default and a `data-foo` attribute default are one arg, so a NEARER
 * template's data-foo (or hand-written `$foo` defaultAttributes key) removes a
 * farther template's `$foo` from this merge; _apply_default_attributes() then
 * applies that nearer data-foo. Within one template the `$foo` arg default wins over
 * its own data-foo, as it always has.
 *
 * @param chain Templates, farthest first (resolve_template_chain())
 */
function merge_define_args(chain: any[]): Record<string, any> {
  const merged: Record<string, any> = {};
  for (const tmpl of chain) {
    if (tmpl.defaultAttributes) {
      for (const key of Object.keys(tmpl.defaultAttributes)) {
        if (key.startsWith('$')) delete merged[key.substring(1)];
        else if (key.startsWith('data-')) delete merged[key.substring(5)];
      }
    }
    if (tmpl.defineArgs) Object.assign(merged, tmpl.defineArgs);
  }
  return merged;
}

// Extend window for debug capabilities
declare global {
  interface Window {
    JQHTML_DEBUG?: {
      log: (componentName: string, phase: string, message: string, data?: any) => void;
      updateTree: () => void;
    };
  }
}

/** One run of on_load()/on_loaded()/on_ready(), while it is in progress (see _call_lifecycle()). */
interface Hook_Run {
  name: string;
  settled: boolean;
  previous: Hook_Run | null;  // The run in progress when this one started (a promoted call nests in an on_ready())
}

/**
 * Development warning, after on_create(), for each top-level property of this.data that
 * is not simple data: a primitive, a plain object, an array, or a value the cache restores
 * as itself (Date, Map, Set, a registered cache class). One level only - nested values are
 * not walked. this.data is copied through the cache serializer right after, so a function,
 * DOM node, jQuery object, component or unregistered class instance does not survive.
 */
function warn_non_simple_create_data(raw: any, component_name: string): void {
  if (get_config().mode !== 'development') return;
  for (const key of Object.keys(raw)) {
    const value = raw[key];
    const type = typeof value;
    let what: string | null = null;
    if (type === 'function') what = 'a function';
    else if (type === 'symbol' || type === 'bigint') what = 'a ' + type;
    else if (value !== null && type === 'object' && !Array.isArray(value)) {
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null && !is_registered_cache_class_instance(value)) {
        what = value instanceof Jqhtml_Component ? 'a component'
          : (typeof Node !== 'undefined' && value instanceof Node) ? 'a DOM node'
          : value.jquery ? 'a jQuery object'
          : 'an instance of ' + ((value.constructor && value.constructor.name) || 'a class');
      }
    }
    if (what) {
      console.warn(
        `[JQHTML] <${component_name}> on_create() set this.data.${key} to ${what}. this.data ` +
        `holds simple data only (strings, numbers, booleans, null, plain objects, arrays, and ` +
        `Date, Map, Set or registered cache classes); it is copied through the cache serializer ` +
        `after on_create(), so this value does not survive as it is. Keep it in this.state or on the component.`
      );
    }
  }
}

export class Jqhtml_Component {
  // Static properties
  static __jqhtml_component = true;       // Marker for unified register() detection
  static template?: any;                  // Template associated with this component class

  // A bare component name, as accepted by closest() in place of a class selector
  static readonly COMPONENT_NAME_PATTERN = COMPONENT_NAME_PATTERN;

  // Public properties
  $: any;                                 // Component's root jQuery element
  args: Record<string, any>;              // Arguments passed to component
  data: Record<string, any>;              // Component's data store (initialized via defineProperty in constructor)
  state: Record<string, any>;             // Arbitrary component state (convention, no special framework behavior)
  _cid: string;                           // Component instance ID for scoping
  _component_name: string;                // The name this instance was invoked as: <Tag_Name>, .component('Tag_Name'), boot placeholder, or the class name
  _ready_state: number = 0;               // 0=created, 1=init, 2=loaded, 3=rendered, 4=ready
  _debug_no_data: boolean = false;         // Set by _reload_without_data(); cleared by any real load

  // Private properties
  private _lifecycle_manager: LifecycleManager;
  private _instantiator: Jqhtml_Component | null = null;  // Component that instantiated this one
  private _dom_parent: Jqhtml_Component | null = null;    // Closest component in DOM tree (for lifecycle)
  private _dom_children: Set<Jqhtml_Component> = new Set();  // Components in DOM subtree (for lifecycle)
  private _use_dom_fallback: boolean = false;  // If true, use find() fallback instead of _dom_children optimization
  private _stopped: boolean = false;
  private _booted: boolean = false;  // Guard to prevent double boot() calls
  private _data_before_render: string | null = null;  // Serialized this.data before the initial render (_should_rerender), custom on_load() only
  private _lifecycle_callbacks: Map<string, Array<(component: Jqhtml_Component) => void>> = new Map();
  private _lifecycle_states: Map<string, any> = new Map();  // Track which lifecycle events have occurred and their data
  private _did_first_render: boolean = false;  // Track if component has rendered at least once
  private _render_count: number = 0;  // Incremented each time _render() is called, used to detect stale renders
  private _args_on_last_render: string | null = null;  // JSON of this.args at the last render (reload() args-changed check), custom on_load() only
  private _data_on_last_render: string | null = null;  // Serialized this.data at the last render (refresh() comparison), custom on_load() only
  private __initial_data_text: string | null = null;  // this.data as on_create() left it (Jqhtml_Local_Storage.snapshot()), restored before every on_load()
  private __data_frozen: boolean = false;  // Track if this.data is currently frozen

  // Serialized text of the current this.data - ONE per data generation. See _data_text().
  // Cleared by the data setter and the unfrozen set/delete traps (data-proxy.ts).
  private __data_text: string | null = null;
  private __data_text_of: object | null = null;  // The raw data object __data_text describes
  private _queue: Component_Queue = new Component_Queue(() => this._on_queue_idle());  // Lifecycle lock + queue: boot, render/load/reload/refresh
  private _load_seq: number = 0;  // Sequence number of the newest load; a load whose number is older is superseded and dropped
  private _ready_owed: boolean = false;  // Boot ended with calls queued: 'ready' fires when the queue goes idle
  private _locked_sync_hook: string | null = null;  // 'on_create' / 'on_render' while this component's own sync hook runs
  private _async_hook: Hook_Run | null = null;  // The innermost on_load/on_loaded/on_ready run in progress (see _queue_call())

  // Cache mode properties
  private _cache_key: string | null = null;  // Cache key for caching
  private _data_cache_key: string | null = null;  // Key the current this.data is cached under (written or hydrated), null if not cached

  // 'html' mode caching
  // The snapshot carries the cid it was taken under, not just markup: every scoped id
  // inside it reads "<name>:<cid>", so replaying it into a different instance requires
  // knowing which cid was the snapshotting component's own. See _rescope_cached_html().
  private _cached_html: { cid: string; html: string } | null = null;  // Cached HTML snapshot to inject on first render
  private _used_cached_html: boolean = false;  // Flag if cached HTML was used (forces re-render after on_load)
  private _should_cache_html_after_ready: boolean = false;  // Flag to cache HTML after on_ready lifecycle
  private _is_dynamic: boolean = false;  // True if the last load is to be cached: data changed, or unchanged under a moved cache key (read by the html snapshot)

  // on_render synchronization (HTML cache mode)
  private _on_render_complete: boolean = false;  // True once the DOM is final post-load (post-load render, or end of the boot render chain)

  // use_cached_data feature - skip on_load() when cache hit occurs
  private _use_cached_data_hit: boolean = false;  // True if use_cached_data=true AND cache was used

  // skip_cache_read - this component (or a component it lives inside) never reads the
  // component cache; every cache write carries on as usual. Resolved once, in the constructor.
  private _skip_cache_read: boolean = false;

  // _load_only: create + load only. No render, no children, no on_render, no on_loaded, no on_ready.
  private _load_only: boolean = false;

  // _load_render_only: create + render + load + re-render. No on_render, no on_loaded, no on_ready.
  private _load_render_only: boolean = false;

  // Detached optimization: true when element is not in the DOM at boot time.
  // Skips initial render and cache read — just on_load then render.
  // Override with _force_initial_render to keep normal double-render behavior.
  _is_detached: boolean = false;
  // was_ready_before(): the answer captured for a key, and whether this instance wrote its marker
  private _ready_before: { key: string; answer: boolean; written: boolean } | null = null;

  // _force_initial_render: override detached optimization — render even when not in DOM.
  // Use when you need the loading spinner visible immediately after appending.
  private _force_initial_render: boolean = false;

  // rendered event - fires once after the synchronous render chain completes
  // (after on_load's re-render if applicable, or after first render if no on_load)
  private _has_rendered: boolean = false;

  // Sequential queue for setting this.data after on_load completes
  // Multiple _load calls can run on_load in parallel, but setting this.data is serialized
  private _load_queue: Promise<void> = Promise.resolve();

  // Cached flag: true if this component has a custom on_load() override
  // Set in constructor (prototype chain is established before constructor runs)
  // Used to skip expensive cache/load operations for static components
  private __has_custom_on_load: boolean = false;

  // on_load_error(): whether it is overridden (an override is what lets a failed load
  // continue), and the latch set by the first on_load() failure - from then on this
  // instance neither reads nor writes the cache (see _run_load_error_hook()).
  private __has_custom_on_load_error: boolean = false;
  private _load_failed: boolean = false;
  // The failure the base on_load_error() printed, so the boot failure path does not
  // print the same error a second time. Boxed: a thrown value may be undefined.
  private _load_error_printed: { error: any } | null = null;

  // gate_load() — "load gates" registered during on_create() that must settle
  // before the component's FIRST on_load() runs. See gate_load() / _await_load_gates().
  private __load_gates: Promise<any>[] = [];        // Pending gates (cleared once the first load begins)
  private __first_load_started: boolean = false;    // Latch: true once the first load phase begins (enforces one-shot + throw-after)
  private __gate_resume: (() => void) | null = null; // Resolver to release an in-progress gate wait early (reload/refresh/stop)

  // DOM attachment state machine - see _attachment_check() / dom-attachment.ts.
  // _attached is the component's OWN belief about whether it is in the document;
  // it flips at most once per direction, and 'attach' / 'detach' fire only on a flip.
  private _attached: boolean = false;
  private _attachment_checked: boolean = false;   // First check has run (after the first 'ready' dispatch)
  private _attachment_tracking: boolean = false;  // Something is interested: on_attach/on_detach overridden, or .on('attach'|'detach')

  constructor(element?: any, args: Record<string, any> = {}) {
    // Detect custom on_load() override immediately
    // Prototype chain is set up before constructor runs, so this.on_load
    // correctly resolves to child class override if one exists
    this.__has_custom_on_load = this.on_load !== Jqhtml_Component.prototype.on_load;
    this.__has_custom_on_load_error = this.on_load_error !== Jqhtml_Component.prototype.on_load_error;

    this._cid = this._generate_cid();
    this._lifecycle_manager = LifecycleManager.get_instance();

    // Create or wrap element
    if (element) {
      this.$ = $(element);
    } else {
      // Use native createElement for better performance
      const div = document.createElement('div');
      this.$ = $(div);
    }

    // Extract $ attributes from element and merge with args
    // $ attributes are stored via jQuery .data() (not as data-* attributes in DOM)
    const dataAttrs: Record<string, any> = {};

    // Get all jQuery .data() values from the element
    if (this.$.length > 0) {
      // Get all data via jQuery .data() without arguments (returns all data as object)
      const allData = this.$.data() || {};
      for (const key in allData) {
        // Skip internal attributes
        if (key !== 'cid' && key !== 'tid' && key !== 'componentName' && key !== 'readyState' &&
            key !== '_lifecycleState' && !key.startsWith('_')) {
          dataAttrs[key] = allData[key];
        }
      }
    }
    
    // The component's template and the chain it inherits defaults from (farthest first)
    let own_template;
    if (args._component_name) {
      own_template = get_template(args._component_name);
    } else {
      own_template = get_template_by_class(this.constructor as any);
    }
    const template_chain = own_template ? resolve_template_chain(own_template, this.constructor) : [];

    // Merge in order: inherited $ arg defaults (nearest <Define> wins) < dataAttrs <
    // args (invocation overrides)
    const defineArgs = merge_define_args(template_chain);
    this.args = { ...defineArgs, ...dataAttrs, ...args };

    // skip_cache_read is reserved: consumed here, never left in this.args, so it cannot
    // reach the cache key or the dedup key (see _find_dom_parent() for inheritance)
    if (this.args.skip_cache_read === true) {
      this._skip_cache_read = true;
    }
    delete this.args.skip_cache_read;

    // The name this instance was invoked as. Every invocation path passes it
    // in args._component_name (template tag, $(el).component('Name'), boot
    // placeholder); a class handed directly to $(el).component(Class) has
    // only its own name to offer.
    const ctor = this.constructor as typeof Jqhtml_Component;
    this._component_name = (typeof args._component_name === 'string' && args._component_name)
      || (ctor as any).component_name
      || ctor.name;

    // Set lifecycle truncation flags from args
    if (this.args._load_only === true) {
      this._load_only = true;
    }
    if (this.args._load_render_only === true) {
      this._load_render_only = true;
    }
    if (this.args._force_initial_render === true) {
      this._force_initial_render = true;
    }

    // Attach component to element
    this.$.data('_component', this);

    // Apply CSS classes and attributes
    this._apply_css_classes();
    this._apply_default_attributes(template_chain);  // Apply defaultAttributes from the template chain
    this._set_attributes();

    // Find DOM parent component (for lifecycle coordination)
    this._find_dom_parent();

    // Setup data property with freeze enforcement using Proxy
    // @see data-proxy.ts for full implementation
    setup_data_property(this);

    // Initialize this.state as an empty object (convention for arbitrary component state)
    // No special meaning to framework - mutable anywhere, not cached, not frozen
    (this as any).state = {};

    // Overriding on_attach()/on_detach() is interest in attachment tracking. Tracking
    // itself only starts after the first 'ready' dispatch (see _attachment_check()).
    if (this.on_attach !== Jqhtml_Component.prototype.on_attach ||
        this.on_detach !== Jqhtml_Component.prototype.on_detach) {
      this._attachment_tracking = true;
    }

    this._log_lifecycle('construct', 'complete');
  }

  /**
   * Protect lifecycle methods from manual invocation
   * Stores original implementations in WeakMap, replaces with guarded wrappers
   * @private
   */
  private _protect_lifecycle_methods(): void {
    const impls: Record<string, Function> = {};
    const self = this;

    for (const [name, help] of PROTECTED_LIFECYCLE_METHODS) {
      const original = (this as any)[name];
      // Skip if using base class default (empty method)
      if (original === Jqhtml_Component.prototype[name as keyof Jqhtml_Component]) continue;

      impls[name] = original;
      // Create wrapper with same function name (for stack traces). The framework calls
      // the stored original through _call_lifecycle(), so any call to the wrapper is manual.
      (this as any)[name] = {
        [name](..._args: any[]) {
          throw new Error(
            `[JQHTML] ${name}() cannot be called manually. ${help}\n` +
            `Component: ${self.component_name()} (_cid: ${self._cid})`
          );
        }
      }[name];
    }

    lifecycle_impls.set(this, impls);
  }

  /**
   * Call a lifecycle method (async)
   * Framework calls this to invoke lifecycle methods, bypassing the protection wrapper.
   * @private
   */
  private async _call_lifecycle<T>(name: string, context?: any, args: any[] = []): Promise<T | void> {
    // Get the original implementation (bypasses wrapper entirely)
    const impl = lifecycle_impls.get(this)?.[name] || (this as any)[name];

    // The async hooks that run inside the lifecycle lock are recorded while they run: a
    // render()/load()/reload()/refresh() called meanwhile is handled per hook when
    // awaited (see _queue_call()).
    if (name === 'on_load' || name === 'on_loaded' || name === 'on_ready') {
      const previous = this._async_hook;
      const run: Hook_Run = { name, settled: false, previous };
      this._async_hook = run;
      try {
        return await impl.apply(context || this, args);
      } finally {
        run.settled = true;
        if (this._async_hook === run) {
          this._async_hook = previous && !previous.settled ? previous : null;
        }
      }
    }

    // Call original directly, bypassing the wrapper
    return await impl.apply(context || this, args);
  }

  /**
   * Call a lifecycle method (sync version for sync methods like on_stop)
   * @private
   */
  private _call_lifecycle_sync<T>(name: string): T | void {
    // Get the original implementation (bypasses wrapper entirely)
    const impl = lifecycle_impls.get(this)?.[name] || (this as any)[name];
    // Call original directly, bypassing the wrapper
    return impl.call(this);
  }

  /**
   * Call on_create() or on_render() and record that it is running, so a render(),
   * load(), reload() or refresh() made from inside it can be warned about (see
   * _queue_call()). Both run inside the lifecycle lock.
   * @private
   */
  private _call_locked_sync_hook<T>(name: string): T | void {
    const previous = this._locked_sync_hook;
    this._locked_sync_hook = name;
    try {
      return this._call_lifecycle_sync<T>(name);
    } finally {
      this._locked_sync_hook = previous;
    }
  }

  /**
   * Fire on_viewport_resize() with the current viewport width.
   * Called after every on_render() and on_ready(); the debounced window
   * listener in viewport.ts drives it from then on. Errors are isolated so a
   * bad handler cannot break the lifecycle.
   *
   * Skipped while the hook resolves to the base no-op (nothing could observe the
   * call). Read live on each fire, so a hook assigned to the instance (class field,
   * on_create(), later) or patched onto a prototype is called like a class override.
   * @private
   */
  private _fire_viewport_resize(): void {
    const hook = this.on_viewport_resize;
    if (hook === base_on_viewport_resize) return;
    try {
      hook.call(this, get_viewport_width());
    } catch (error) {
      console.error(
        `[JQHTML] Error in on_viewport_resize() for ${this.component_name()}:`,
        error
      );
    }
  }

  /**
   * Check if on_load() is overridden in a subclass
   * Used to skip the load phase entirely for components that don't fetch data
   * Returns cached value set in _boot() for O(1) performance
   * @private
   */
  private _has_on_load(): boolean {
    return this.__has_custom_on_load;
  }

  /**
   * The loaded step for a component with NO custom on_load(): on_loaded(), then the
   * 'loaded' event, at the point where on_load() would have completed (boot,
   * load(), reload(), refresh()). Every component gets them, whether or not it fetches
   * data; a component with on_load() gets them from _apply_load_result() / load().
   *
   * Suppressed by _load_only and _load_render_only (preloading mode), exactly as for a
   * component with on_load(). Never runs on a stopped component, and 'loaded' does not
   * fire if on_loaded() awaited across a stop().
   *
   * Returns null when nothing was awaited: on_loaded() is the base no-op, so 'loaded'
   * fired synchronously and the caller's chain does not yield - a template-only
   * component's boot stays synchronous. Otherwise a promise for on_loaded() + 'loaded'.
   * @private
   */
  private _loaded_without_on_load(): Promise<void> | null {
    if (this._stopped || this._load_only || this._load_render_only) return null;

    if (this.on_loaded === Jqhtml_Component.prototype.on_loaded) {
      this.trigger('loaded');
      return null;
    }

    return (async () => {
      await this._call_lifecycle('on_loaded');

      // on_loaded() may have awaited across a stop(); don't fire 'loaded' after it.
      if (this._stopped) return;

      this.trigger('loaded');
    })();
  }

  /**
   * Boot - Start the full component lifecycle
   * Called immediately after construction by instruction processor
   */
  /**
   * Internal boot method - starts component lifecycle
   * @private
   */
  async _boot(): Promise<void> {
    // Guard: prevent double boot() calls
    if (this._booted) return;
    this._booted = true;

    // Protect lifecycle methods from manual invocation (must happen after subclass constructor)
    // Note: __has_custom_on_load is already set in constructor
    this._protect_lifecycle_methods();

    await this._lifecycle_manager.boot_component(this);
  }

  // -------------------------------------------------------------------------
  // Lifecycle Methods (called by LifecycleManager)
  // -------------------------------------------------------------------------
  
  /**
   * The component render(sid) and _render(sid) delegate to: the one on this
   * component's $sid element. Throws when there is no such element, or when it is
   * not a component (no $redrawable).
   * @private
   */
  private _redraw_target(id: string): any {
    const $element = this.$sid(id);
    if ($element.length === 0) {
      throw new Error(
        `[JQHTML] render("${id}") - no such id.\n` +
        `Component "${this.component_name()}" has no child element with $sid="${id}".`
      );
    }

    const child = $element.data('_component');
    if (!child) {
      throw new Error(
        `[JQHTML] render("${id}") - element is not a component or does not have $redrawable attribute set.\n` +
        `Element with $sid="${id}" exists but is not initialized as a component.\n` +
        `Add $redrawable attribute or make it a proper component.`
      );
    }

    return child;
  }

  /**
   * Internal render phase - Create DOM structure
   * Called top-down (parent before children) when part of lifecycle
   * This is an internal method - users should call render() instead
   *
   * @param id Optional scoped ID - if provided, delegates to child component's _render()
   * @returns The current _render_count after incrementing (used to detect stale renders)
   * @private
   */
  _render(id: string | null = null, options: { skip_on_render?: boolean } = {}): number {
    // Increment render count to track this specific render
    this._render_count++;
    const current_render_id = this._render_count;

    if (this._stopped) return current_render_id;

    // If id provided, delegate to child component
    if (id) {
      return this._redraw_target(id)._render(null, options);
    }

    this._log_lifecycle('render', 'start');

    // --- Shared re-render prologue -------------------------------------------------
    // Everything below runs for BOTH the cached-HTML path and the template path. The
    // cached path used to return before it, so a cache-mode reload injected over a live
    // subtree without ever stopping the old children: their on_stop() never ran (timers
    // and listeners leaked) and they stayed in _dom_children as dead entries that every
    // later _wait_for_children_ready() walked.

    // Determine child-finding strategy: If component is off-DOM, children can't register
    // via _find_dom_parent() (no parent in DOM to find), so we'll need find() fallback later.
    // If attached to DOM, children register normally and we can use the fast _dom_children path.
    // Check is cheap ($.contains uses native Node.contains, ~500K ops/sec).
    if (!$.contains(document.documentElement, this.$[0])) {
      this._use_dom_fallback = true;
    } else {
      this._use_dom_fallback = false;
    }

    // If this is not the first render, stop child components and clear DOM
    if (this._did_first_render) {
      // Stop all child components before clearing DOM
      this.$.find('.Component').each(function() {
        const child = $(this).data('_component');
        if (child && !child._stopped) {
          child._stop(); // Stop just the component, DOM will be cleared next
        }
      });

      // Clear the DOM
      this.$[0].innerHTML = '';
    } else {
      this._did_first_render = true;
    }

    // (No removeClass('_Component_Stopped') here: _render() returns above when
    // _stopped, and nothing ever clears _stopped, so a stopped component can never
    // reach this line. Clearing the class would only ever hide a real stopped state.)

    // Clear DOM children tracking - they're destroyed by innerHTML = '' anyway
    this._dom_children.clear();
    // --- End shared re-render prologue ---------------------------------------------

    // HTML CACHE MODE - If we have cached HTML, inject it directly and skip template rendering
    if (this._cached_html !== null) {
      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Cache html] Component ${this._cid} (${this.component_name()}) injecting cached HTML`,
          { html_length: this._cached_html.html.length, snapshot_cid: this._cached_html.cid }
        );
      }

      // Inject cached HTML directly, with every scoped id re-scoped to THIS instance.
      // The snapshot was taken from another component instance (or an earlier life of
      // this one), so its ids carry that instance's cids verbatim. Injecting them as-is
      // put duplicate ids in the document, and $sid() - which is getElementById first -
      // could hand this component the other instance's element.
      this.$[0].innerHTML = this._rescope_cached_html(this._cached_html);

      // Mark that we used cached HTML (forces re-render after on_load)
      this._used_cached_html = true;

      // Clear cached HTML so next render uses template
      this._cached_html = null;

      this._log_lifecycle('render', 'complete (cached HTML)');

      // Call on_render() after cache inject (unless suppressed by _load_render_only)
      if (!options.skip_on_render) {
        const cacheRenderResult = this._call_locked_sync_hook('on_render');
        if (cacheRenderResult && typeof (cacheRenderResult as any).then === 'function') {
          console.warn(
            `[JQHTML] Component "${this.component_name()}" returned a Promise from on_render(). ` +
            `on_render() must be synchronous code. Remove 'async' from the function declaration.`
          );
        }
        this._fire_viewport_resize();
      }

      // Emit lifecycle event
      this.trigger('render');

      // Store args/data snapshots for later comparison
      this._record_render_snapshots();

      return current_render_id;
    }

    // Capture data state before first render for comparison later. Read only by
    // _should_rerender(), which answers false without it when there is no custom on_load().
    if (this._data_before_render === null && this.__has_custom_on_load) {
      this._data_before_render = this._data_text();
    }

    // Get template and render it
    let template_def;

    // If we have a component name, try looking up by name first (for unregistered components)
    if (this.args._component_name) {
      template_def = get_template(this.args._component_name);
    } else {
      // Otherwise look up by class
      template_def = get_template_by_class(this.constructor as any);
    }

    // extends="" naming a template the JS class does not descend from would render one
    // parent's markup over another's methods. Thrown here, so it takes the boot error
    // path: logged, this component stopped, waiting ancestors released.
    const extends_error = template_def?.extends ? extends_conflict(template_def, this.constructor) : null;
    if (extends_error) {
      throw new Error(extends_error);
    }

    if (template_def && template_def.render) {
      // Utilities the compiled render function calls (see render_utilities)
      const jqhtml = render_utilities;

      // Execute template function
      // Commented out debug logging
      // console.log('[Component] About to call render, this:', this);
      // console.log('[Component] this.constructor.name:', this.constructor.name);
      // console.log('[Component] this.data:', this.data);
      // console.log('[Component] this.args:', this.args);

      // What content() returns: the slot's buffer, or '' when it emits nothing (see
      // markup_has_content), so a slot written empty tests falsy like an absent one
      const content_or_empty = (markup: any) =>
        markup instanceof Jqhtml_Markup && !markup_has_content(markup) ? '' : markup;

      // Create content function that handles both default content and named slots
      const createContentFunction = () => {
        const defaultContentFn = this.args._innerhtml_function;
        const slotsObj = this.args._slots;

        // Return a function that handles both slot names and default content
        return (slotName?: string, ...slotArgs: any[]) => {
          // If slot name provided and slots object exists, try to use named slot
          if (slotName && slotsObj && slotsObj[slotName]) {
            // Call the slot function - it returns its markup buffer
            return content_or_empty(slotsObj[slotName](...slotArgs));
          }
          // If slot name provided but not found, return empty
          else if (slotName) {
            return '';
          }
          // No slot name = default content
          else if (defaultContentFn) {
            return content_or_empty(defaultContentFn(this));
          }
          // No content at all
          else {
            return '';
          }
        };
      };

      const contentFunction = createContentFunction();

      // A markup buffer, or {_slots: {...}} from a slot-only template
      let rendered: any = template_def.render.bind(this)(
        this.data,
        this.args,
        contentFunction, // Content function with slot support
        jqhtml // Utilities object
      );

      // Check for template inheritance (slot-only OR explicit extends)
      // If the result is {_slots: {...}}, find parent template and invoke it
      if (!(rendered instanceof Jqhtml_Markup) && rendered && rendered._slots) {
        const component_name = template_def.name || this.args._component_name || this.constructor.name;
        const parent = resolve_parent_template(template_def, this.constructor);

        // A slot-only template is nothing but an override of a parent. With no parent
        // there is nothing to render, and rendering empty hides the mistake (usually a
        // missing register_template) behind a blank element. Fail loudly instead.
        if (!parent) {
          throw new Error(
            `[JQHTML] ${component_name}: slot-only template has no parent template. ` +
            `Add extends="Parent_Name" to <Define:${component_name}>, extend a class whose ` +
            `template is registered, or give the template markup of its own.`
          );
        }

        // Create a content function that invokes child slots
        // When parent calls content('slotName'), it invokes the child's slot function
        const childSlots = rendered._slots;
        const contentFunction = (slotName: string, ...slotArgs: any[]) => {
          if (childSlots[slotName] && typeof childSlots[slotName] === 'function') {
            // Invoke the slot function with everything content() was given; its
            // markup buffer is what the template expression handler splices
            return content_or_empty(childSlots[slotName](...slotArgs));
          }
          // Slot not found, return empty
          return '';
        };

        // Invoke parent template with child's slots as content function.
        // A parent template that throws is a real defect in the parent's markup. It used
        // to be swallowed into an empty render plus a warning nobody reads; it is now
        // re-thrown, which routes it through the boot error path: logged, this component
        // stopped, its waiting ancestors released.
        try {
          rendered = parent.template.render.bind(this)(
            this.data,
            this.args,
            contentFunction, // Pass content function that invokes child slots
            jqhtml
          );
        } catch (error) {
          // Rethrown, not swallowed - only re-labelled so the report names both ends
          // of the inheritance, which the raw template error does not.
          const wrapped = new Error(
            `[JQHTML] ${component_name}: parent template ${parent.name} threw while ` +
            `rendering slot-only child: ${(error as Error)?.message ?? error}`
          );
          (wrapped as any).cause = error;  // ES2020 target: Error(message, {cause}) is not typed
          throw wrapped;
        }
      }

      // Process instructions to generate DOM. Markup buffers spliced in by
      // content() are handled by the processor, which renders them in the
      // component that wrote them.
      // This kicks off child component boots but doesn't wait for them
      process_instructions(rendered.instructions, this.$, this);
    }

    // Don't update ready state here - let phases complete in order
    this._update_debug_attrs();

    this._log_lifecycle('render', 'complete');

    // Call on_render() after render completes (unless suppressed by _load_render_only)
    if (!options.skip_on_render) {
      const renderResult = this._call_locked_sync_hook('on_render');
      if (renderResult && typeof (renderResult as any).then === 'function') {
        console.warn(
          `[JQHTML] Component "${this.component_name()}" returned a Promise from on_render(). ` +
          `on_render() must be synchronous code. Remove 'async' from the function declaration.`
        );
      }
      this._fire_viewport_resize();
    }

    // "Already rendered once" - read before the state below can move to 3.
    const isRerender = this._ready_state >= 3;

    // HTML CACHE MODE: Mark on_render complete after the post-on_load render.
    // This signals to parent components that this component's DOM is fully rendered
    // with fresh data and ready for HTML snapshot. It is set BEFORE trigger('render')
    // because _wait_for_children_on_render() waits on that very event and reads the
    // flag from its handler.
    if (this._ready_state >= 2) {
      this._on_render_complete = true;

      // State 3 = "rendered with loaded data, ready phase not finished yet".
      // Only meaningful once the load phase has happened (>= 2); before that the
      // component is still walking 0 -> 1 -> 2 and must not be pushed forward.
      // The ready phase (_ready(), render()'s executor, _reload()) restores 4.
      this._ready_state = 3;
      this._update_debug_attrs();
    } else if (!this.__has_custom_on_load) {
      // A component with no custom on_load() fetches nothing (only on_loaded()/'loaded' run), so it never
      // reaches _ready_state 2 and would never set the flag above - and its data cannot
      // change, so this first render IS its final, fresh render. Without this, an
      // html-cache parent waited forever in _wait_for_children_on_render() for a
      // template-only child and never snapshotted, rendered or fired 'ready'.
      this._on_render_complete = true;
    }

    // Emit lifecycle event
    this.trigger('render');

    // Apply debug delay after render
    applyDebugDelay(isRerender ? 'rerender' : 'render');

    // Store args/data snapshots for reload()/refresh() comparison
    this._record_render_snapshots();

    // Return the render ID so callers can check if this render is still current
    return current_render_id;
  }

  /**
   * Record what this render was made from, for _reload(): the args (did they change
   * since, so try the cache?) and the data (did refresh() bring anything new?).
   *
   * Skipped for a component with no custom on_load(). _reload() is the only reader of
   * both fields and returns before reading them for such a component - it just
   * re-renders - so serializing args and data on every one of its renders bought
   * nothing. For a list of row components that was most of the cost of a re-render.
   * @private
   */
  private _record_render_snapshots(): void {
    if (!this.__has_custom_on_load) return;

    // JSON text of args, compared against JSON.stringify(this.args) in _reload().
    // null (args hold a cycle) disables the comparison.
    try {
      this._args_on_last_render = JSON.stringify(this.args);
    } catch (error) {
      this._args_on_last_render = null;
    }

    this._data_on_last_render = this._data_text();
  }

  /**
   * The serialized text of this.data - Jqhtml_Local_Storage.serialize() output - used
   * for every "did this.data change?" decision (_should_rerender(), load(), _reload(),
   * refresh()) and as the text written to the cache and handed to load followers.
   *
   * One text per data generation. The text a load result was normalized through is
   * installed directly (_assign_load_result()), and any other text is computed once
   * and kept while this.data is frozen - frozen data cannot change, and every way of
   * replacing it (the data setter, an unfrozen set/delete) clears the text. It is
   * computed from the raw data object, not through the deep-freeze proxies, which
   * would allocate a read-only wrapper for every nested object they hand out.
   *
   * The cache serializer, not JSON.stringify: JSON renders every Map and Set as {},
   * so data loaded into one never registered as changed.
   * @private
   */
  _data_text(): string {
    const raw = (this.data as any)[RAW_DATA];
    if (this.__data_text !== null && this.__data_text_of === raw && this.__data_frozen) {
      return this.__data_text;
    }

    // null: the data as a whole cannot be serialized (a getter threw). Never equal to
    // anything, so it reads as "changed" - the safe answer, a re-render.
    const text = Jqhtml_Local_Storage.serialize(raw) ?? `\u0000unserializable:${uid()}`;
    if (this.__data_frozen) {
      this.__data_text = text;
      this.__data_text_of = raw;
    }
    return text;
  }

  /**
   * Make a load result this.data: normalize it through the cache serializer, assign it
   * (unfreeze, assign, refreeze), and keep the text it was normalized through as the new
   * generation's _data_text(). Returns that text.
   *
   * Every on_load() result goes through here - in EVERY cache mode, not just 'data'.
   * Two consequences the rest of the framework depends on:
   *   - this.data is jqhtml's own copy. The author's object graph is never aliased,
   *     so mutating what on_load() returned cannot reach a frozen this.data.
   *   - this.data is BY CONSTRUCTION what the cache stores and what a cache hit
   *     returns. Hot and cold are the same object shape in every mode, so turning
   *     caching on can never change what a component sees.
   * Dates, Maps, Sets and register_cache_class() classes are reconstructed; anything
   * the serializer cannot express is dropped and warned about once (local-storage.ts).
   * @private
   */
  private _assign_load_result(result_data: Record<string, any>): string {
    const { value, text } = Jqhtml_Local_Storage.normalize(result_data, this.component_name());
    this.__data_frozen = false;
    this.data = value;
    this.__data_frozen = true;
    this.__data_text = text;
    this.__data_text_of = (this.data as any)[RAW_DATA];
    return text;
  }

  /**
   * Public render method - re-renders component and completes lifecycle
   * This is what users should call when they want to update a component.
   *
   * Lifecycle sequence (serialized via component queue):
   * 1. _render() - Updates DOM synchronously, calls on_render(), fires 'render' event
   * 2. _wait_for_children_ready() - Waits for all children to reach ready state
   * 3. on_ready() - Calls user's ready hook
   * 4. trigger('ready') - Fires ready event
   *
   * Goes through the component queue to prevent concurrent lifecycle operations.
   * Returns a Promise that resolves when the full render lifecycle completes.
   */
  render(id: string | null = null): Promise<void> {
    if (this._stopped) return Promise.resolve();

    // If id provided, delegate to child component.
    // NOTE: this runs BEFORE invalidate('ready'). render(sid) does not start a
    // lifecycle on THIS component - it delegates to the redrawable child, which
    // invalidates and re-triggers its own 'ready'. Invalidating here would delete
    // this component's sticky ready marker with nothing left to re-trigger it, so
    // every later `await comp.ready()` would hang.
    if (id) {
      return this._redraw_target(id).render();
    }

    // Invalidate ready event so new handlers wait for this render cycle to complete
    // This prevents .on('ready') handlers from firing immediately based on previous lifecycle
    this.invalidate('ready');

    // Enqueue the full render lifecycle through the component's lifecycle lock.
    // Return the queue promise so `await this.render()` resolves when the
    // full render lifecycle (DOM update, children ready, on_ready) completes
    return this._queue_call('render', 'render', async () => {
      // The queued executor can start long after render() was called - re-check.
      if (this._stopped) return;

      // Execute render phase synchronously and capture render ID
      const render_id = this._render();

      // Wait for all child components to be ready
      await this._wait_for_children_ready();

      // Stopped while waiting for children: no hook, no event on a dead component.
      if (this._stopped) return;

      // Check if this render is still current before calling on_ready
      // If _render_count changed, another render happened and we should skip on_ready
      if (this._render_count !== render_id) {
        return; // Stale render, don't call on_ready
      }

      // Call on_ready hook with authorization
      await this._call_lifecycle('on_ready');

      // on_ready() may itself have awaited long enough for a stop().
      if (this._stopped) return;

      this._fire_viewport_resize();

      // Back to the ready state (_render() dropped it to 3) and 'ready' - unless boot's
      // 'ready' is still owed, which the queue going idle fires (_entry_ready_point()).
      this._entry_ready_point();
    });
  }

  /**
   * Alias for render() - re-renders component with current data
   * Provided for API consistency and clarity
   */
  redraw(id: string | null = null): Promise<void> {
    return this.render(id);
  }

  /**
   * Re-fetch data by executing on_load() without triggering re-render or lifecycle.
   *
   * Runs on_load() on a detached proxy (same restrictions as during boot):
   *   - this.data is restored to on_create() snapshot, then unfrozen for writing
   *   - this.args is read-only
   *   - All other properties (this.$, this.$sid, etc.) are blocked
   *
   * After on_load() completes, this.data is atomically updated and re-frozen.
   * The developer decides what to do next (e.g., call this.render()).
   *
   * Pattern: load() invokes on_load(), just as render() invokes on_render().
   *
   * @returns true if this.data changed, false if unchanged
   */
  load(): Promise<boolean> {
    if (this._stopped) return Promise.resolve(false);

    // No custom on_load() means there is nothing to fetch and nothing can have changed:
    // this.data is left exactly as on_create() set it (running the detached execution
    // anyway would seed it with the empty detached clone - create() takes no snapshot
    // for these components). What does run is the loaded step every component gets:
    // on_loaded() and 'loaded', queued like any other load(). Always false.
    if (!this.__has_custom_on_load) {
      return this._queue_call('load', 'load', async () => {
        if (this._stopped) return false;
        const loaded = this._loaded_without_on_load();
        if (loaded) await loaded;
        return false;
      }, true);
    }

    // The queue settles this caller with the value of the executor that actually
    // ran - including one that collapsed two rapid load() calls into one run - so
    // the result is returned from the executor, not read back out of a closure
    // variable that a discarded executor would have left at its initial value.
    return this._queue_call('load', 'load', async () => {
      // The queued executor can start long after load() was called - re-check.
      if (this._stopped) return false;

      // Any real load returns the component to normal, whatever the debug tool did.
      this._debug_no_data = false;

      // Snapshot current data for change detection
      const data_before = this._data_text();

      // Execute on_load() on detached proxy (restores data to on_create snapshot). A
      // failure goes through on_load_error(): recovered, its fallback is applied below
      // like loaded data (never cached); not recovered, load() rejects.
      const load_seq = ++this._load_seq;
      const attempt = await this._execute_on_load_or_recover(null);

      // Stopped during on_load(): don't write data or cache for a dead component.
      if (!attempt || this._stopped) return false;
      const result_data = attempt.data;

      // A newer load started meanwhile: its result is the one that counts.
      if (this._load_superseded(load_seq)) return false;

      // Atomically update this.data: unfreeze → normalize → assign → refreeze.
      // The round trip runs in EVERY cache mode - see _assign_load_result().
      const data_after = this._assign_load_result(result_data);

      const cache_mode = Jqhtml_Local_Storage.get_cache_mode();

      // Detect if data changed
      const data_changed = data_before !== data_after;

      // ONE derivation, shared with the cache read in create() and with _load().
      // The copy that used to live here omitted content serialization, so an
      // object-arg component computed a null key and silently never wrote the
      // cache that create() would later read with the content-serialized key.
      // Recomputed rather than reused: args may have changed since boot.
      const key_result = generate_cache_key(this);
      const cache_key = key_result.cache_key;

      // The same record boot and reload() leave: the offending arg on the element and
      // one dev warning, or no data-nocache once the args are keyable again. A silent
      // catch here made a throwing cache_id() undiagnosable.
      mark_cacheability(this, key_result);

      // Update cache with fresh data if changed - never once a load has failed.
      if (data_changed) {
        this._data_cache_key = null;
        if (!this._load_failed && cache_key !== null && cache_mode !== 'html') {
          Jqhtml_Local_Storage.set_serialized(cache_key, data_after);
          this._data_cache_key = cache_key;
        }
      }

      // Call on_loaded() on the real component (this.data frozen, full access to this.$, this.state)
      // Suppressed by _load_only and _load_render_only flags (preloading mode)
      if (!this._load_only && !this._load_render_only) {
        await this._call_lifecycle('on_loaded');

        // on_loaded() may have awaited across a stop(); don't fire 'loaded' after it.
        if (this._stopped) return data_changed;

        this.trigger('loaded');
      }

      return data_changed;
    }, true);
  }

  /**
   * Create phase - Quick setup, prepare UI
   * SYNCHRONOUS - no awaits, no yields
   */
  create(): void {
    if (this._stopped || this._ready_state >= 1) return;

    this._log_lifecycle('create', 'start');

    // Detect detached elements — skip cache and initial render for elements not in DOM
    // _force_initial_render overrides this optimization. Set before on_create() so
    // was_ready_before() called there sees it.
    this._is_detached = !this.$[0].isConnected && !this._force_initial_render;

    // Call on_create() synchronously - it MUST be synchronous
    const result = this._call_locked_sync_hook('on_create');
    if (result && typeof (result as any).then === 'function') {
      console.warn(
        `[JQHTML] Component "${this.component_name()}" returned a Promise from on_create(). ` +
        `on_create() must be synchronous code. Remove 'async' from the function declaration.`
      );
      // Don't await - on_create MUST be sync. The warning is enough.
    }

    // Make this.data jqhtml's own copy of what on_create() left, for EVERY component -
    // the same serializer round trip every on_load() result goes through. on_create()
    // may have put objects into this.data that it also keeps elsewhere
    // (`this.state.list = this.data.list = []`); without the copy, mutating them later
    // through that other reference would change frozen data behind the freeze. The text
    // is the cache serializer's snapshot (keys holding undefined keep their key), and it
    // is also what on_load() restarts from. Untouched data ({} with no keys) is skipped:
    // its copy would be itself. The copy is installed after the cache read below, and
    // only if that read did not already replace this.data with a cached copy.
    const created_raw = (this.data as any)[RAW_DATA];
    const created_touched = Object.getPrototypeOf(created_raw) !== Object.prototype || Object.keys(created_raw).length > 0;
    if (created_touched) warn_non_simple_create_data(created_raw, this.component_name());
    const created_text = created_touched
      ? (Jqhtml_Local_Storage.snapshot(created_raw) ?? '{}')
      : '{}';

    // OPTIMIZATION: Skip cache operations and snapshot if no custom on_load()
    // Components without on_load() don't fetch data, so nothing to cache or restore
    if (this.__has_custom_on_load) {
      // Snapshot this.data the moment on_create() returns, BEFORE any cache read.
      // on_load() restarts from this snapshot every time, and CLAUDE.md promises that
      // is the on_create() state. read_cache_in_create() REPLACES this.data on a warm
      // 'data' cache, so snapshotting after it made a warm boot restart on_load() from
      // cached data - `this.data.items.push(x)` doubled its rows on every reload.
      // The cache serializer (snapshot() also keeps keys holding undefined), so a Date,
      // Map, Set or registered class set here is what on_load() finds - a JSON copy
      // handed on_load() a string, {} and a missing key instead.
      this.__initial_data_text = created_text;

      // CACHE CHECK - Read from cache based on cache mode ('data' or 'html')
      // Skip cache for detached elements — no point hydrating from cache when not in DOM
      // @see component-cache.ts for full implementation
      if (!this._is_detached) {
        read_cache_in_create(this);
      }
    }

    if (created_touched && (this.data as any)[RAW_DATA] === created_raw) {
      this.data = Jqhtml_Local_Storage.restore_snapshot(created_text) ?? {};
    }

    // Freeze this.data after on_create() - only on_load() can modify it now.
    // on_create() may have mutated nested values no trap sees: start a new generation.
    this.__data_text = null;
    this.__data_frozen = true;

    this._ready_state = 1;
    this._update_debug_attrs();

    this._log_lifecycle('create', 'complete');

    // Emit lifecycle event
    this.trigger('create');
  }
  
  /**
   * Register a "load gate" — a promise that must settle before this component's
   * FIRST on_load() runs.
   *
   * Register gates during on_create(). Multiple calls accumulate; all gates are
   * awaited together (via Promise.allSettled) at the seam between create and the
   * first load. A REJECTED gate does NOT block or abort the load — it is an
   * ordering hint, not a data dependency, so loading proceeds after settlement
   * (rejections are logged through the debug channel).
   *
   * Gates are ONE-SHOT: they delay the first on_load() only. Once that load
   * begins the gate list is cleared, and reload()/refresh() never re-await gates.
   * Calling reload()/refresh() while a gate is still holding the first load
   * releases the wait immediately and resumes the lifecycle (a later gate
   * settlement then does nothing).
   *
   * Gates delay ONLY the on_load phase — never create(), the initial render,
   * on_render(), or the cached-content first paint (stale-while-revalidate is
   * preserved). Components with no custom on_load() ignore gates entirely.
   *
   * No-op during SSR (the server cannot await arbitrary client promises).
   *
   * jqhtml has no knowledge of WHAT is being awaited — the caller supplies the
   * promise, and policy such as timeouts is the caller's responsibility (bake it
   * into the promise you pass).
   *
   * @param promise The promise to await before the first on_load().
   * @throws If called after the component's first load has already started.
   */
  gate_load(promise: Promise<any>): void {
    if (this.__first_load_started) {
      throw new Error(
        `[JQHTML] gate_load() may only be called before the component's first load - ` +
        `register gates in on_create(). ` +
        `Component: ${this.component_name()} (_cid: ${this._cid})`
      );
    }
    this.__load_gates.push(promise);
  }

  /**
   * Await all registered load gates before the first on_load().
   *
   * Called exactly once, at the boot seam immediately before the load phase
   * (only for components with a custom on_load()). Latches "first load started"
   * so any later gate_load() throws and reload()/refresh() never re-await.
   *
   * Returns a promise to await when there are gates to wait on, or `null` when
   * there is nothing to wait for (no gates, or SSR). Returning `null` keeps the
   * common no-gate path free of an extra microtask hop, so it does not shift the
   * timing of ungated components.
   *
   * The returned promise resolves as soon as any of the following happens
   * (whichever is first — the rest become no-ops):
   *   - all gates settle (Promise.allSettled),
   *   - reload()/refresh() is called while gated (they resolve __gate_resume),
   *   - the component is stopped (stop() resolves __gate_resume).
   *
   * @private
   */
  private _await_load_gates(): Promise<void> | null {
    // Latch (synchronous): from here on, gate_load() throws and this runs at
    // most once — set even when there are no gates so point 2 always holds.
    this.__first_load_started = true;

    const gates = this.__load_gates;
    this.__load_gates = [];

    // Nothing to gate, or SSR (cannot await arbitrary client promises) — proceed now.
    if (gates.length === 0 || is_capture_enabled()) return null;

    // Promise.allSettled never rejects; rejected gates are logged (debug channel)
    // whenever they settle, independent of whether the wait was resumed early.
    const settled = Promise.allSettled(gates);
    settled.then((results) => {
      for (const result of results) {
        if (result.status === 'rejected' && (window as any).jqhtml?.debug?.verbose) {
          console.log(
            `[JQHTML gate_load] Component ${this._cid} (${this.component_name()}) gate rejected (ignored, load proceeds)`,
            result.reason
          );
        }
      }
    });

    // Race gate settlement against an early-resume signal (reload/refresh/stop while gated).
    return new Promise<void>((resolve) => {
      this.__gate_resume = resolve;
      settled.then(() => resolve());
    }).then(() => {
      this.__gate_resume = null;
    });
  }

  /**
   * Load phase - Fetch asynchronous data
   * Called bottom-up, fully parallel
   * NO DOM MODIFICATIONS ALLOWED IN THIS PHASE
   *
   * Key design: on_load() runs on a DETACHED proxy with a clone of this.data.
   * The real component's this.data is not touched during on_load execution.
   * After on_load completes, the result is applied via a sequential queue.
   *
   * @private - Internal lifecycle method, not for external use
   */
  async _load(): Promise<void> {
    if (this._stopped || this._ready_state >= 2) return;

    // Any real load returns the component to normal, whatever the debug tool did.
    this._debug_no_data = false;

    this._log_lifecycle('load', 'start');

    // use_cached_data feature: If cache hit occurred and use_cached_data=true, skip on_load() entirely
    // The cached data is already in this.data from create() phase
    if (this._use_cached_data_hit) {
      this._ready_state = 2;
      this._update_debug_attrs();
      this._log_lifecycle('load', 'complete (use_cached_data - skipped on_load)');
      this.trigger('load');
      if (!this._load_only && !this._load_render_only) {
        await this._call_lifecycle('on_loaded');
        this.trigger('loaded');
      }
      return;
    }

    // TWO identities, deliberately computed separately.
    //
    // cache_key  - may key a plain-data object arg by deterministic CONTENT, and may come
    //              from the author's cache_id(). A wrong key here is corrected by
    //              stale-while-revalidate.
    // dedup_key  - args only, no content serialization, no cache_id(). A deduplicated
    //              follower never runs on_load() and adopts the leader's data with NO
    //              revalidation, so a wrong key here is permanently wrong data. Redundant
    //              concurrent requests are the cheaper failure.
    const key_result = generate_cache_key(this);
    const { cache_key, uncacheable_property, uncacheable_reason } = key_result;

    const dedup_key = Load_Coordinator.generate_invocation_key(this.component_name(), this.args).key;

    // Caching disabled - mark the element with the offending arg AND why; keyable args
    // clear any stale mark. No warning here: create() already gave it for these args.
    mark_cacheability(this, key_result, false);

    // SSR preload check: if preloaded data exists for this component+args, use it
    if (cache_key !== null && has_preload_data()) {
      const preloaded_data = consume_preload_data(cache_key);
      if (preloaded_data !== null) {
        this._cache_key = cache_key;

        if ((window as any).jqhtml?.debug?.verbose) {
          console.log(
            `[SSR Preload] Component ${this._cid} (${this.component_name()}) using preloaded data`,
            { cache_key }
          );
        }

        const data_before_load = this._data_text();
        await this._apply_load_result(preloaded_data, data_before_load);
        return;
      }
    }

    // Store cache key for later use
    this._cache_key = cache_key;

    if (cache_key === null && uncacheable_property) {
      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Cache] Component ${this._cid} (${this.component_name()}) has non-keyable args - caching disabled`,
          { uncacheable_property, uncacheable_reason }
        );
      }
    }

    // Store "before" snapshot for comparison after on_load()
    const data_before_load = this._data_text();

    // This load's sequence number - a result whose number is no longer the newest is
    // dropped (_load_superseded()).
    const load_seq = ++this._load_seq;

    // No dedup identity - run on_load() alone rather than risk sharing a load
    if (dedup_key === null) {
      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Load Deduplication] Component ${this._cid} (${this.component_name()}) has no dedup key - loading independently`
        );
      }
      const attempt = await this._execute_on_load_or_recover(null);
      // Removed while on_load() ran: nothing to apply to, and on_loaded() must not run
      if (!attempt || this._stopped || this._load_superseded(load_seq)) return;
      await this._apply_load_result(attempt.data, data_before_load);
      return;
    }

    // Check if this component should execute on_load() or wait for existing request
    const should_execute = Load_Coordinator.should_execute_on_load(this, dedup_key);

    if (!should_execute) {
      // This component is a follower - wait for leader to complete
      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Load Deduplication] Component ${this._cid} (${this.component_name()}) is a follower, waiting for leader`,
          { args: this.args }
        );
      }

      // Every coordinator call uses the key captured ABOVE, before on_load() began.
      // Recomputing it here would miss the entry whenever args changed meanwhile.
      const coordination_promise = Load_Coordinator.get_coordination_promise(dedup_key);
      if (coordination_promise) {
        // Wait for leader to complete (rejects if the leader's load failed)
        let leader_failed = false;
        let leader_error: any;
        try {
          await coordination_promise;
        } catch (error) {
          leader_failed = true;
          leader_error = error;
        }

        // The shared request failed: this component's load failed with it. It runs
        // its OWN on_load_error() with the leader's error - never the leader's fallback.
        if (leader_failed) {
          const fallback = await this._run_load_error_hook(leader_error);
          if (fallback === null || this._stopped) return;
          await this._apply_load_result(fallback, data_before_load);
          return;
        }

        // Retrieve leader's data from coordinator. Collected even when this follower
        // was stopped meanwhile: the call is what removes it from the entry's waiting
        // list, and the entry is freed when the last follower collects.
        const leader_data = Load_Coordinator.get_leader_data(this, dedup_key);

        if (this._stopped || this._load_superseded(load_seq)) return;

        if (leader_data !== null) {
          // Apply leader's data using the same method as leader
          // This properly handles freeze/unfreeze and normalization
          await this._apply_load_result(leader_data, data_before_load);

          if ((window as any).jqhtml?.debug?.verbose) {
            console.log(
              `[Load Deduplication] Component ${this._cid} applied data from leader`,
              { data: this.data }
            );
          }

          // _apply_load_result already sets ready_state and triggers 'load'
          return;
        }
      }

      // No leader data to adopt (the entry was already collected, or its data could
      // not be serialized). Load independently rather than firing load/loaded with the
      // untouched on_create() data.
      const attempt = await this._execute_on_load_or_recover(null);
      if (!attempt || this._stopped || this._load_superseded(load_seq)) return;
      await this._apply_load_result(attempt.data, data_before_load);
      return;
    }

    // This component is a leader - execute on_load() on detached proxy
    if ((window as any).jqhtml?.debug?.verbose) {
      console.log(
        `[Load Deduplication] Component ${this._cid} (${this.component_name()}) is the leader`,
        { args: this.args }
      );
    }

    // Execute on_load on detached proxy with Load_Coordinator registration. If on_load()
    // throws, the entry is already rejected (every follower runs its own on_load_error())
    // and what comes back is this component's own fallback, with no coordination.
    const attempt = await this._execute_on_load_or_recover(dedup_key);
    if (!attempt) return;
    const { data: result_data, complete_coordination } = attempt;

    // Removed while on_load() ran, or superseded by a newer load. Nothing is applied to
    // this component (no this.data assignment, no cache write, no on_loaded()), but the
    // followers still get the data it fetched: they are live components with the same
    // args, and failing or re-fetching for them would only repeat a request that
    // already succeeded.
    if (this._stopped || this._load_superseded(load_seq)) {
      if (complete_coordination) {
        let stopped_text: string;
        try {
          this._check_load_result(result_data);
          stopped_text = Jqhtml_Local_Storage.normalize(result_data, this.component_name()).text;
        } catch (error) {
          Load_Coordinator.handle_leader_error(dedup_key, error as Error);
          return;
        }
        complete_coordination(stopped_text);
      }
      return;
    }

    // Apply result via sequential queue. A failure here (on_load() left this.data
    // non-object, or on_loaded() threw) is a failed leader load exactly like on_load()
    // throwing: release the entry through the same path, or every follower and every
    // later same-args component waits on it forever.
    let final_text: string;
    try {
      final_text = await this._apply_load_result(result_data, data_before_load);
    } catch (error) {
      // Only while this leader still owns the entry. After a recovered on_load()
      // failure the entry is gone, and the key may already belong to a new leader.
      if (complete_coordination) {
        Load_Coordinator.handle_leader_error(dedup_key, error as Error);
      }
      throw error;
    }

    // Complete coordination AFTER this.data is updated. Followers receive the
    // serialized text of the data this load produced - the text this.data was
    // normalized through, so nothing is serialized again here.
    if (complete_coordination) {
      complete_coordination(final_text);
    }
  }

  /**
   * Execute on_load() on a fully detached proxy.
   * @see data-proxy.ts for full implementation
   * @private
   */
  private async _execute_on_load_detached(dedup_key: string | null = null): Promise<{
    data: Record<string, any>;
    complete_coordination: ((final_text: string | null) => void) | null;
  }> {
    return execute_on_load_detached(this, dedup_key);
  }

  /**
   * Run on_load() for a load, routing a failure through on_load_error().
   *
   * @returns What _execute_on_load_detached() returns on success. After a failure an
   *          on_load_error() override recovered from: the fallback data, with no
   *          coordination (fallback data is never handed to deduplication followers).
   *          null when the component was stopped and the load is abandoned.
   *          Throws when the failure is not recovered (see _run_load_error_hook()).
   * @private
   */
  private async _execute_on_load_or_recover(dedup_key: string | null = null): Promise<{
    data: Record<string, any>;
    complete_coordination: ((final_text: string | null) => void) | null;
  } | null> {
    try {
      return await this._execute_on_load_detached(dedup_key);
    } catch (error) {
      const fallback = await this._run_load_error_hook(error);
      return fallback === null ? null : { data: fallback, complete_coordination: null };
    }
  }

  /**
   * A load failed: this component's on_load() threw, or the deduplicated load it shared
   * did. Every caller (boot, reload(), refresh(), load()) comes through here.
   *
   * - Latches _load_failed: from now on this instance neither reads nor writes the
   *   cache, in any cache mode, even after a later successful load.
   * - on_load_error() not overridden: the base prints the error and it is rethrown. The
   *   boot path stops the component; reload()/refresh()/load() reject. Unchanged.
   * - Overridden: the override runs in on_load()'s detached context (read this.args,
   *   write this.data from the on_create() snapshot) and the data it leaves is
   *   returned as the fallback; the lifecycle continues with it. If the override
   *   throws, that is rethrown - the no-override path, without the base's print.
   *
   * @returns The fallback data, or null if the component is (or became) stopped
   * @private
   */
  private async _run_load_error_hook(error: any): Promise<Record<string, any> | null> {
    this._load_failed = true;

    if (!this.__has_custom_on_load_error) {
      Jqhtml_Component.prototype.on_load_error.call(this, error);
      throw error;
    }

    // A stopped component runs no more hooks; there is nothing left to recover.
    if (this._stopped) return null;

    const fallback = await execute_on_load_error_detached(this, error);
    return this._stopped ? null : fallback;
  }

  /**
   * Throw unless on_load() left this.data as an object (arrays included).
   * @private
   */
  private _check_load_result(result_data: any): void {
    if (result_data === null || typeof result_data !== 'object') {
      const value_type = typeof result_data;
      const shown = value_type === 'string' ? JSON.stringify(result_data)
        : value_type === 'function' ? 'a function'
        : String(result_data);
      throw new Error(
        `[JQHTML] Component "${this.component_name()}" on_load() left this.data as ${shown}. ` +
        `this.data must be an object - assign properties to it (this.data.items = ...) ` +
        `or assign an object (this.data = {...}).`
      );
    }
  }

  /**
   * Apply the result of on_load() to this.data via the sequential queue.
   *
   * Multiple _load calls can execute on_load in parallel, but this method
   * ensures that setting this.data happens in FIFO order.
   *
   * @param result_data - The data returned from _execute_on_load_detached
   * @param data_before_load - _data_text() of this.data before on_load (for change detection), or null
   * @returns The serialized text of the data applied (see _assign_load_result())
   * @private
   */
  private async _apply_load_result(result_data: Record<string, any>, data_before_load: string | null): Promise<string> {
    // Queue this operation - wait for any earlier _load calls to finish setting data
    const my_turn = this._load_queue;

    let resolve_my_turn: () => void;
    this._load_queue = new Promise<void>((resolve) => {
      resolve_my_turn = resolve;
    });

    // Wait for our turn
    await my_turn;

    try {
      // this.data must be an object. Rejected here, before anything is unfrozen or
      // assigned: a null or primitive result would otherwise fail inside the data
      // setter and leave this.data unfrozen.
      this._check_load_result(result_data);

      // Now it's our turn to set this.data - round-tripped through the cache
      // serializer in every cache mode (see _assign_load_result()).
      const data_after_load = this._assign_load_result(result_data);

      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Cache] Component ${this._cid} (${this.component_name()}) normalized this.data after on_load()`,
          { data: this.data }
        );
      }

      // SSR data capture: record this component's data for preloading
      if (is_capture_enabled() && this._has_on_load() && !this._load_failed) {
        capture_component_data(
          this.component_name(),
          this.args,
          this.data,
          this._cache_key
        );
      }

      // Calculate if data changed
      const data_changed = data_before_load !== null && data_after_load !== data_before_load;

      // CACHE WRITE - also sets _is_dynamic (this load is worth caching), which the
      // html snapshot reads. @see component-cache.ts
      write_cache_on_loaded(this, data_changed, data_after_load);

      this._ready_state = 2;
      this._update_debug_attrs();

      this._log_lifecycle('load', 'complete');

      // Emit lifecycle event
      this.trigger('load');

      // Call on_loaded() - runs on the REAL component (not detached proxy)
      // this.data is frozen (read-only), but this.$, this.state, this.args are accessible
      // Suppressed by _load_only and _load_render_only flags (preloading mode)
      if (!this._load_only && !this._load_render_only) {
        await this._call_lifecycle('on_loaded');
        this.trigger('loaded');
      }

      return data_after_load;
    } finally {
      // Signal next in queue
      resolve_my_turn!();
    }
  }
  
  /**
   * Ready phase - Component fully initialized
   * Called bottom-up (children before parent)
   * @private
   */
  async _ready(): Promise<void> {
    if (this._stopped || this._ready_state >= 4) return;

    this._log_lifecycle('ready', 'start');

    // HTML CACHE MODE - Wait for children on_render, then snapshot
    // @see component-cache.ts for write_html_cache_snapshot implementation
    // A component stopped during any await below (a parent re-render removing it,
    // an explicit stop()) abandons the phase: no snapshot of a dead DOM, no on_ready()
    // after on_stop(), no ready state, no 'ready' event.
    if (this._should_cache_html_after_ready && this._cache_key) {
      await this._wait_for_children_on_render();
      if (this._stopped) return;
      write_html_cache_snapshot(this);
    }

    // Wait for all children to reach ready state (bottom-up execution)
    await this._wait_for_children_ready();
    if (this._stopped) return;

    // on_ready() runs inside the lifecycle lock, like every other cycle's: a
    // render()/load()/reload()/refresh() made from it waits and starts after boot ends -
    // unless on_ready() awaits it, which runs it at once (see _queue_call()).
    await this._call_lifecycle('on_ready');
    if (this._stopped) return;
    this._fire_viewport_resize();

    this._log_lifecycle('ready', 'complete');

    // Calls queued during boot (from on_ready() or anywhere else) replace the state boot
    // reached, and so does a promoted call still running. 'ready' fires once they have
    // all run, when the queue goes idle (_on_queue_idle()), so a waiter sees the
    // post-reload state.
    if (this._queue.has_pending || this._queue.promoted_running) {
      this._ready_owed = true;
      return;
    }
    this._fire_ready();
  }

  /**
   * Set the ready state and fire 'ready'. The state is set BEFORE the trigger so a
   * handler that calls ready() during dispatch takes the already-ready fast path.
   * @private
   */
  private _fire_ready(): void {
    this._ready_owed = false;
    this._ready_state = 4;
    this._update_debug_attrs();
    this._write_ready_marker();
    this.trigger('ready');
  }

  /**
   * Whether a previous instance of this component, under the cache key of its current
   * args (or cache_id()), reached ready in the current cache scope. A hint for the
   * application (e.g. show a spinner only on a cold first visit); jqhtml never acts on it.
   *
   * Opt-in: only a component that calls this records a marker when it reaches ready, so
   * components that never ask cost nothing and store nothing. The answer is captured the
   * first time it is asked for a key and frozen for that key: this instance reaching
   * ready does not turn its own answer true. New args (a different key) are looked up
   * afresh. False for unkeyable args, a detached component, or no cache key set.
   *
   * Ready is reached bottom-up, so a marker implies the component's whole subtree
   * reached ready at least once in that scope.
   */
  was_ready_before(): boolean {
    if (this._is_detached) return false;
    const { cache_key } = generate_cache_key(this);
    if (cache_key === null) return false;
    if (this._ready_before?.key !== cache_key) {
      this._ready_before = {
        key: cache_key,
        answer: Jqhtml_Local_Storage.get(`${cache_key}::ready`) !== null,
        written: false,
      };
    }
    return this._ready_before.answer;
  }

  /**
   * At a ready point, record the marker was_ready_before() reads - only for the key this
   * component asked about, once, and not when the answer was already true.
   * @private
   */
  private _write_ready_marker(): void {
    const asked = this._ready_before;
    if (asked === null || asked.answer || asked.written || this._is_detached) return;
    if (generate_cache_key(this).cache_key !== asked.key) return;
    Jqhtml_Local_Storage.set(`${asked.key}::ready`, 1);
    asked.written = true;
  }

  /**
   * A render/reload/refresh entry reached its 'ready' point. Deferred to the queue going
   * idle (_on_queue_idle()) while 'ready' is already owed (boot ended with calls queued)
   * or a promoted call is still running (see _queue_call()) - a promoted entry counts
   * itself, so it never fires 'ready' in the middle of the cycle it is nested in.
   * @private
   */
  private _entry_ready_point(): void {
    if (this._ready_owed || this._queue.promoted_running) {
      this._ready_owed = true;
      return;
    }
    this._fire_ready();
  }

  /**
   * The lifecycle queue went idle. Fires the 'ready' boot deferred because calls were
   * queued when it ended (see _ready()).
   * @private
   */
  private _on_queue_idle(): void {
    if (this._ready_owed && !this._stopped) {
      this._fire_ready();
    }
  }

  /**
   * True (and logged in verbose mode) when a newer load has started since the load
   * numbered `load_seq` began. The older result is dropped: applying it would put
   * data fetched for older args over newer data. The lifecycle lock already prevents
   * overlapping loads; this guards any path that ever does overlap.
   * @private
   */
  private _load_superseded(load_seq: number): boolean {
    if (load_seq === this._load_seq) return false;
    if ((window as any).jqhtml?.debug?.verbose) {
      console.log(
        `[JQHTML] Component ${this._cid} (${this.component_name()}) dropped the result of a superseded load`,
        { load_seq, newest: this._load_seq }
      );
    }
    return true;
  }

  /**
   * Put a render/load/reload/refresh call on this component's lifecycle queue.
   *
   * Where the call was made decides what its promise does when awaited:
   *   - from this component's own on_create()/on_render(): warned at once (development).
   *     It is queued behind the running lifecycle step, so it does not run there.
   *   - while this component's on_ready() runs: awaiting (or chaining) the promise before
   *     on_ready() has settled pulls the queued call forward and runs it at once, nested
   *     (Component_Queue.promote()). Unawaited, it runs after on_ready() returns.
   *   - while on_loaded() runs: awaiting it before on_loaded() has settled warns
   *     (development). It cannot start until on_loaded() returns - a deadlock.
   *   - while on_load() runs, or anywhere else: a plain promise; the call waits its turn.
   * @param method - Public method name, for the warnings
   * @param key - Queue key: method plus arguments. Only identical keys merge.
   * @param async_hops - Settle the caller a few microtasks after the queue does, as an
   *        async method would. load()/reload()/refresh() were async methods; the extra hops
   *        put a caller's `await` after the queue has released the lock, so
   *        `await c.reload(); c.render();` starts the render at once instead of queueing it.
   * @private
   */
  private _queue_call<T>(method: string, key: string, executor: () => Promise<T>, async_hops: boolean = false): Promise<T> {
    const development = get_config().mode === 'development';
    if (this._locked_sync_hook !== null && development) {
      const hook = this._locked_sync_hook;
      const purpose = hook === 'on_render'
        ? 'on_render() is for styling freshly rendered DOM'
        : 'on_create() is for setting initial this.args and this.data';
      console.warn(
        `[JQHTML] ${this.component_name()}: ${method}() called from ${hook}() does not belong there. ` +
        `${purpose}; ${method}() waits until the current lifecycle step finishes, so it does not run here. ` +
        `Call it from on_ready() or an event handler.`
      );
    }

    // Read before enqueueing: an idle component starts the call synchronously, and its
    // own on_load() is then the running hook - not one this call was made from.
    const run = this._async_hook;
    const { promise, entry } = this._queue.enqueue(key, executor);
    const result = async_hops ? (async () => promise)() : promise;

    // Started at once, or not made during on_ready()/on_loaded(): nothing to add.
    if (entry === null || run === null || run.settled) return result;

    // An on_ready() still running - the innermost hook, or one a promoted call is nested
    // in (after a promotion, the outer on_ready() keeps running alongside the nested
    // call's hooks) - may be the one awaiting this call.
    let ready_run: Hook_Run | null = run;
    while (ready_run !== null && (ready_run.settled || ready_run.name !== 'on_ready')) {
      ready_run = ready_run.previous;
    }
    if (ready_run !== null) {
      const owner = ready_run;
      return Lifecycle_Call_Promise.wrap(result, () => {
        if (!owner.settled) this._queue.promote(entry);
      });
    }

    if (run.name === 'on_loaded' && development) {
      const name = this.component_name();
      return Lifecycle_Call_Promise.wrap(result, () => {
        if (run.settled) return;
        console.warn(
          `[JQHTML] ${method}() was awaited while ${name}'s on_loaded() is still running. ` +
          `If on_loaded() awaits this call it will deadlock: call it without await. ` +
          `Code outside the component should await comp.ready() before awaiting reload() or refresh().`
        );
      });
    }

    return result;
  }

  /**
   * Public API: Wait for component to be fully ready
   * Returns a promise that resolves when the component reaches ready state.
   * Optionally accepts a callback that executes when ready.
   *
   * @example
   * // Promise pattern
   * await component.ready();
   *
   * @example
   * // Callback pattern
   * component.ready(() => {
   *   console.log('Component is ready!');
   * });
   *
   * @example
   * // Both patterns work together
   * await component.ready(() => console.log('Callback fired'));
   *
   * @param callback Optional callback to execute when ready
   */
  ready(callback?: () => void): Promise<void> {
    // If already ready AND the ready event hasn't been invalidated, resolve immediately
    // Both conditions must be true: _ready_state >= 4 means we reached ready once,
    // _lifecycle_states.has('ready') means we haven't started a new reload/render cycle
    if (this._ready_state >= 4 && this._lifecycle_states.has('ready')) {
      if (callback) callback();
      return Promise.resolve();
    }

    // Resolves on 'ready', or on 'stop': a stopped component never fires 'ready'
    // again, so a waiter must be released rather than left hanging (a component
    // whose hook throws during boot is stopped, and `await jqhtml.boot()` waits here).
    return this._settle_on('ready', callback);
  }

  /**
   * Promise that resolves when `event_name` fires OR the component stops, whichever
   * comes first - resolves immediately if the component is already stopped. Used by
   * ready(), rendered() and _wait_for_children_ready(): a stopped component never
   * fires either event again, so waiting on the event alone hangs every waiter
   * forever.
   *
   * Resolves rather than rejects: the documented contract is that waiters on a
   * failed or stopped component are RELEASED, and existing `await comp.ready()` code
   * does not catch. Callers that need to know can check is_stopped() afterwards.
   *
   * The optional callback runs ONLY when the event itself fires, never on stop: it
   * is developer code written for a ready/rendered DOM, and calling it on a stopped
   * component would be a new call into user code the contract never made.
   *
   * Both listeners are one-shot and the first to fire removes the other, so repeated
   * waits on a long-lived component do not accumulate handlers in either queue.
   * @private
   */
  private _settle_on(event_name: string, callback?: () => void): Promise<void> {
    return new Promise<void>((resolve) => {
      let settled = false;
      const settle = (run_callback: boolean) => {
        if (settled) return;
        settled = true;
        // There is no off() in the event API; splice this handler out of both
        // queues the way once() does.
        for (const name of [event_name, 'stop']) {
          const callbacks = this._lifecycle_callbacks.get(name);
          if (callbacks) {
            for (const handler of [on_stop, on_event]) {
              const idx = callbacks.indexOf(handler);
              if (idx !== -1) callbacks.splice(idx, 1);
            }
          }
        }
        // Resolve before the callback: a callback that throws must not leave the
        // promise pending (the throw is still reported by the event dispatcher).
        resolve();
        if (run_callback && callback) callback();
      };
      const on_stop = () => settle(false);
      const on_event = () => settle(true);

      if (this._stopped) {
        settle(false);
        return;
      }
      // 'stop' first: registering event_name can fire on_event synchronously (sticky),
      // and settle must be able to deregister both queues when it does.
      this.on('stop', on_stop);
      if (!settled) this.on(event_name, on_event);
    });
  }

  /**
   * Returns a promise that resolves when the component has completed its
   * synchronous render chain (after on_load's re-render if applicable,
   * or after first render if no on_load override).
   *
   * This fires BEFORE on_ready() and before children are waited on.
   * Use this when you need to know the component's DOM is stable but
   * don't need to wait for the full async ready phase.
   *
   * The 'rendered' event fires exactly once per component lifecycle.
   *
   * @example
   * await component.rendered();
   * // DOM is now stable, on_render has completed
   *
   * @param callback Optional callback to execute when rendered
   */
  rendered(callback?: () => void): Promise<void> {
    // Like ready(): also released when the component stops, since a stopped
    // component never fires 'rendered'.
    return this._settle_on('rendered', callback);
  }

  /**
   * Wait for all child components to reach ready state
   * Ensures bottom-up ordering (children ready before parent)
   * @private
   */
  private async _wait_for_children_ready(): Promise<void> {
    // Server-rendered components (created via jqhtml.boot()) may have children
    // that were hydrated asynchronously during the 'render' event callback.
    // Those children couldn't register via _find_dom_parent() because they were
    // created after the parent's lifecycle started. Force DOM traversal fallback
    // to reliably discover all children, including boot-hydrated ones.
    if (this.args._inner_html !== undefined) {
      this._use_dom_fallback = true;
    }

    const children = this._get_dom_children();

    if (children.length === 0) {
      return; // No children, nothing to wait for
    }

    // Create promises for each child that hasn't reached ready yet
    const ready_promises: Promise<void>[] = [];

    for (const child of children) {
      // If child already ready, skip
      if (child._ready_state >= 4) {
        continue;
      }

      // A stopped child will never fire 'ready' again - waiting on it would wedge
      // this parent (and everything awaiting its ready()) forever.
      if ((child as any)._stopped) {
        continue;
      }

      // Resolves on the child's 'ready', or on its 'stop' so a child stopped mid-wait
      // releases the parent. _settle_on() registers one handler per event and removes
      // both when either fires, so repeated waits (every render/reload cycle of a
      // polling parent) leave nothing behind in either queue.
      ready_promises.push(child._settle_on('ready'));
    }

    // Wait for all children to be ready
    await Promise.all(ready_promises);
  }

  /**
   * Wait for all child components to complete on_render (post-on_load)
   * Used by HTML cache mode to ensure DOM is fully rendered before taking snapshot
   *
   * HTML CACHE ARCHITECTURE:
   * - Parent waits for all children to complete their on_render after on_load
   * - This ensures the HTML snapshot captures fully rendered DOM
   * - Static parents (is_dynamic=false) don't block - they immediately let children proceed
   *
   * @private
   */
  private async _wait_for_children_on_render(): Promise<void> {
    const children = this._get_dom_children();

    if (children.length === 0) {
      return; // No children, nothing to wait for
    }

    // Create promises for each child that hasn't completed on_render yet
    const render_promises: Promise<void>[] = [];

    for (const child of children) {
      // If child already completed on_render post-on_load (or is dead), skip
      if (child._on_render_complete || child._stopped) {
        continue;
      }

      // Event-driven, not polled: the child sets _on_render_complete just before it
      // fires 'render' (a post-load re-render) or 'rendered' (the end of its boot render
      // chain, which is the only signal when its load left the data unchanged and it did
      // not re-render), and 'stop' ends the wait for a child that dies first.
      //
      // A plain once('render') would be wrong: events are sticky, and this child has
      // already rendered at least once (the pre-on_load render), so once() would fire
      // immediately off that stale marker and let the parent snapshot half-rendered DOM.
      // The handler therefore re-checks the flag and stays registered until it is set.
      const render_promise = new Promise<void>((resolve) => {
        let settled = false;
        const on_child_event = () => {
          if (settled) return;
          if (!child._on_render_complete && !child._stopped) return;  // pre-load render
          settled = true;
          // There is no off() in the event API; splice this handler out of every queue
          // the way once() does, so a long-lived child does not accumulate handlers
          // across repeated waits.
          for (const event_name of ['render', 'rendered', 'stop']) {
            const callbacks = child._lifecycle_callbacks.get(event_name);
            if (callbacks) {
              const idx = callbacks.indexOf(on_child_event);
              if (idx !== -1) callbacks.splice(idx, 1);
            }
          }
          resolve();
        };
        // 'stop' first: registering 'render'/'rendered' can fire the handler
        // synchronously (sticky), and the handler must be able to deregister every queue
        // when it does - and a queue registered after a settle would leak the handler.
        child.on('stop', on_child_event);
        if (!settled) child.on('rendered', on_child_event);
        if (!settled) child.on('render', on_child_event);
      });

      render_promises.push(render_promise);
    }

    // Wait for all children to complete on_render
    await Promise.all(render_promises);
  }


  /**
   * Reload component - re-fetch data and re-render.
   *
   * Goes through the component's lifecycle queue: while the component is busy (boot,
   * or another entry running) the call waits as an entry and runs in order. It merges
   * only into an identical call waiting right before it (see Component_Queue).
   *
   * @param always_render - If true (default), always re-render after on_load().
   *                        If false, only re-render if data actually changed (refresh()).
   */
  reload(always_render?: boolean): Promise<void> {
    return this._queue_reload(always_render !== false, 'reload');
  }

  /**
   * Refresh component - re-fetch data and re-render only if data changed.
   *
   * Same as reload(false). Queued like reload(); a refresh() and a reload() are
   * separate entries and each runs with its own render rule.
   */
  refresh(): Promise<void> {
    return this._queue_reload(false, 'refresh');
  }

  /** @private - shared by reload() and refresh() */
  private _queue_reload(force_render: boolean, method: string): Promise<void> {
    // Load-gate short-circuit: if a gate is currently holding the first on_load,
    // reload()/refresh() resumes the paused boot lifecycle instead of running its
    // normal re-fetch. The boot lifecycle then proceeds to run on_load (the fresh
    // fetch) exactly as reload() would want. Any later gate settlement becomes a
    // no-op. Return a promise that resolves when the component is ready.
    if (this.__gate_resume) {
      const resume = this.__gate_resume;
      this.__gate_resume = null;
      resume();
      return this.ready();
    }

    return this._queue_call(method, force_render ? 'reload' : 'refresh', () => this._reload(force_render), true);
  }

  /**
   * Re-render this component from its on_create() state with its cache dropped and
   * WITHOUT running on_load()/on_loaded()/on_ready().
   *
   * @internal debug tool. Used by the debug overlay's lifecycle footer to see what a
   * component looks like with no loaded data at all. Not public API, not documented,
   * and no downstream code should call it: reload() or refresh() afterwards returns
   * the component to normal (the snapshot is intact and the cache is gone, so the
   * next load is a genuine fresh fetch).
   */
  _reload_without_data(): Promise<void> {
    if (this._stopped) return Promise.resolve();

    // Same marker invalidation reload()/render() do: later ready() waiters must wait
    // for THIS cycle rather than resolve off the previous one.
    this.invalidate('ready');

    // Serialised with reload()/refresh() so it can never interleave with a real load.
    return this._queue.enqueue('reload_without_data', async () => {
      if (this._stopped) return;

      // Drop this component's own cache entries (data and html snapshot), so a later
      // reload() genuinely re-fetches instead of hydrating from what is on screen now.
      const { cache_key } = generate_cache_key(this);
      if (cache_key !== null) {
        Jqhtml_Local_Storage.remove(cache_key);
        Jqhtml_Local_Storage.remove(`${cache_key}::html`);
      }
      this._data_cache_key = null;

      // Back to the on_create() state. Components with no custom on_load() take no
      // snapshot (nothing can have changed this.data), so they simply re-render.
      if (this.__initial_data_text !== null) {
        this.__data_frozen = false;
        this.data = Jqhtml_Local_Storage.restore_snapshot(this.__initial_data_text) ?? {};
        this.__data_frozen = true;
      }

      // Read by the debug overlay's lifecycle row; cleared by _reload()/load()/_load().
      this._debug_no_data = true;

      this._render();
      await this._wait_for_children_ready();

      if (this._stopped) return;

      this._entry_ready_point();
    }).promise;
  }

  /**
   * Internal reload implementation - re-fetch data and re-render
   *
   * COMPLETE RELOAD PROCESS (Source of Truth):
   *
   * STEP 1: Cache key refresh, cache check (if args changed since last render)
   *   - Generate cache key from component name + current args, and ALWAYS store it
   *     (null included) so this reload's writes go to the current args' entry
   *   - Set or clear data-nocache (and the dev warning) as boot and load() do
   *   - If cached data exists and is non-empty:
   *     - Unfreeze this.data (temporarily)
   *     - Hydrate this.data with cached data
   *     - Re-freeze this.data
   *     - Render immediately (stale-while-revalidate)
   *     - Set rendered_from_cache flag
   *
   * STEP 2: Call on_load() to fetch fresh data
   *   - Unfreeze this.data
   *   - Restore this.data to on_create() snapshot
   *   - Call on_load() directly (no _load() wrapper)
   *   - Freeze this.data after completion
   *   - If data changed and non-empty, or is unchanged but the cache key moved
   *     (new args): write to cache
   *
   * STEP 3: Conditionally re-render
   *   - If didn't render from cache yet, OR data changed after on_load():
   *     - Call render() to update DOM
   *
   * STEP 3.5: Wait for all children to be ready
   *   - Bottom-up ordering (children ready before parent)
   *   - Same as main lifecycle
   *   - html cache mode: snapshot the post-reload markup if this load changed data
   *
   * STEP 4: Call on_ready()
   *   - Always call on_ready() after reload completes
   *
   * A failed cycle (on_load() failure not recovered by on_load_error(), or any other
   * throw) restores the ready state it found before rejecting - see below.
   *
   * @param force_render - true for reload() (always render), false for refresh()
   *                       (render only if the data changed)
   * @private - Use reload() / refresh() instead (queued wrappers)
   */
  async _reload(force_render: boolean = true): Promise<void> {
    if (this._stopped) return;

    // Any real load returns the component to normal, whatever the debug tool did.
    this._debug_no_data = false;

    // Was the component ready (state AND sticky marker) when this cycle began?
    const was_ready = this._ready_state >= 4 && this._lifecycle_states.has('ready');

    // Invalidate ready event so new handlers wait for this reload to complete
    // This prevents .on('ready') handlers from firing immediately based on previous lifecycle
    this.invalidate('ready');

    try {
      await this._reload_cycle(force_render);
    } catch (error) {
      // The cycle deleted the sticky 'ready' marker above and may have dropped
      // _ready_state (load phase 2, render 3). Rejecting without restoring both left
      // every later `await comp.ready()` - and a parent re-entering
      // _wait_for_children_ready() - hanging forever. The component is still alive and
      // showing its previous render, which was ready: restore that, then reject.
      // on_ready() is NOT called again (nothing new was rendered).
      if (was_ready && !this._stopped) {
        this._ready_state = 4;
        this._update_debug_attrs();
        this.trigger('ready');
      }
      throw error;
    }
  }

  /**
   * The body of _reload(), after the ready marker has been invalidated.
   * @private
   */
  private async _reload_cycle(force_render: boolean): Promise<void> {
    this._log_lifecycle('reload', 'start');

    // OPTIMIZATION: If no custom on_load(), skip data fetching entirely
    // Just re-render with current data and call on_ready
    if (!this.__has_custom_on_load) {
      // The loaded step (on_loaded(), 'loaded') where on_load() would have completed -
      // before the render, as for a component with on_load().
      const loaded = this._loaded_without_on_load();
      if (loaded) await loaded;
      if (this._stopped) return;

      this._render();
      await this._wait_for_children_ready();

      // Stopped while waiting for children: no hook, no event on a dead component.
      if (this._stopped) return;

      await this._call_lifecycle('on_ready');

      // on_ready() may itself have awaited long enough for a stop().
      if (this._stopped) return;

      this._fire_viewport_resize();
      // Restore the ready state (_render() dropped it to 3) and fire 'ready'
      this._entry_ready_point();

      this._log_lifecycle('reload', 'complete (no on_load)');
      return;
    }

    // STEP 1: Cache check (if args changed)
    let rendered_from_cache = false;
    let data_before_load: string | null = null;

    // Check if args changed (skip if args are non-serializable)
    let args_changed = false;
    if (this._args_on_last_render) {
      try {
        args_changed = JSON.stringify(this.args) !== this._args_on_last_render;
      } catch (error) {
        // Args contain circular references - cannot detect change, assume changed
        args_changed = true;
      }
    }

    // Refreshes _cache_key from the current args (null included) and, if they changed,
    // renders from the cache. @see component-cache.ts for full implementation
    rendered_from_cache = check_cache_on_reload(this, args_changed);

    // Capture data state before on_load for comparison
    data_before_load = this._data_text();

    // STEP 2: Call on_load() on detached proxy
    // This uses the same detached execution as _load() - on_load runs isolated
    // and result is applied via sequential queue. A failure goes through
    // on_load_error(): recovered, the fallback is applied and rendered like loaded
    // data (never cached); not recovered, it throws out to _reload().
    const load_seq = ++this._load_seq;
    const attempt = await this._execute_on_load_or_recover(null);  // null = no coordination

    // Stopped during on_load(): don't write data or re-render a dead component.
    if (!attempt || this._stopped) return;
    const result_data = attempt.data;

    // A newer load started meanwhile: its result is the one that counts, and the cycle
    // that started it finishes the render and 'ready'.
    if (this._load_superseded(load_seq)) return;

    // Apply result via sequential queue
    // This handles normalization, caching, and setting _is_dynamic
    await this._apply_load_result(result_data, data_before_load);

    // The apply queue can yield; a stop() there must abort the render/ready tail.
    if (this._stopped) return;

    // Re-read data state after apply (for render decision below)
    const data_after_load = this._data_text();
    const data_changed = data_after_load !== data_before_load;

    // STEP 3: Conditionally re-render (with refresh() support)

    // Track if we need to render
    let should_render = false;

    // HTML CACHE MODE: a cache injection above replaced the subtree with inert markup -
    // a snapshot string, with no live child components in it. It must be re-rendered
    // from the template regardless of what the load decided, exactly as _should_rerender()
    // forces it at boot. Without this, a reload whose data came back unchanged left dead
    // HTML (stopped children, no instances) on screen.
    const used_cached_html = this._used_cached_html;
    if (used_cached_html) {
      this._used_cached_html = false;
    }

    if (force_render) {
      // reload(true) or reload() - always render if we haven't yet, OR data changed
      should_render = !rendered_from_cache || data_changed;
    } else {
      // refresh() / reload(false) - only render if data changed from last render
      if (rendered_from_cache) {
        // First render was called (args changed, cache available)
        // Compare data after on_load() vs data used in that first render
        const data_from_first_render = this._data_on_last_render;
        should_render = data_after_load !== data_from_first_render;
      } else {
        // First render was NOT called (args same or no cache)
        // Compare data after on_load() vs last recorded render
        const last_rendered_data = this._data_on_last_render;
        should_render = data_after_load !== last_rendered_data;
      }
    }

    // STEP 3: Perform second render if needed
    // The cache injection's inert markup is not optional to replace - this overrides both
    // the reload() and the refresh()/reload(false) decision above.
    if (used_cached_html) {
      should_render = true;
    }

    if (should_render) {
      this._render();
    }

    // STEP 3.5 & 4: Wait for children and call on_ready (only if we rendered)
    if (rendered_from_cache || should_render) {
      await this._wait_for_children_ready();

      // Stopped while waiting for children: no hook, no event on a dead component.
      if (this._stopped) return;

      // HTML CACHE MODE: snapshot the post-reload markup, at the point boot's _ready()
      // does (children rendered, before on_ready()). Without this the html entry kept
      // the boot-time markup for as long as the instance lived.
      if (this._should_cache_html_after_ready && this._cache_key) {
        write_html_cache_snapshot(this);
      }

      await this._call_lifecycle('on_ready');

      // on_ready() may itself have awaited long enough for a stop().
      if (this._stopped) return;

      this._fire_viewport_resize();
      // Restore the ready state (the load phase dropped it to 2, _render() to 3)
      // and fire 'ready' so parent callbacks fire on subsequent reloads
      this._entry_ready_point();
    } else {
      // refresh()/reload(false) found unchanged data: no re-render, and on_ready()
      // is deliberately NOT called (documented behaviour). But the component IS
      // ready - and this cycle deleted the sticky 'ready' marker at the top of
      // _reload() and dropped _ready_state to 2 in the load phase. Without
      // restoring both, ready() never resolves again and a parent re-entering
      // _wait_for_children_ready() hangs on this child forever (the documented
      // polling pattern breaks after its first quiet refresh).
      // The markup on screen is the last render of exactly this data, so a pending
      // html snapshot (data changed since the load before) is still taken.
      if (this._should_cache_html_after_ready && this._cache_key) {
        write_html_cache_snapshot(this);
      }
      this._entry_ready_point();
    }

    this._log_lifecycle('reload', 'complete');
  }

  /**
   * Destroy the component and cleanup
   * Called automatically by MutationObserver when component is removed from DOM
   * Can also be called manually for explicit cleanup
   */
  /**
   * Internal stop method - stops just this component (no children)
   * Sets stopped flag, calls lifecycle hooks, but leaves DOM intact
   * @private
   */
  _stop(): void {
    // Guard: prevent double _stop() calls
    if (this._stopped) return;
    this._stopped = true;

    // If a load gate is holding the first on_load, release the wait so the boot
    // lifecycle unwinds cleanly (it will see _stopped and abandon the load).
    if (this.__gate_resume) {
      const resume = this.__gate_resume;
      this.__gate_resume = null;
      resume();
    }

    // There is deliberately NO fast path for components without stop logic. The
    // marker class, the parent de-registration and the 'stop' event are not cleanup
    // the component asked for, they are how the rest of the framework learns this
    // component is dead: the class is the documented, observable stopped state; a
    // child left in _dom_parent._dom_children is a dead component every later
    // _wait_for_children_ready() and _get_dom_children() walks; and 'stop' is what
    // releases a parent (and boot's failure path) waiting on a child that will never
    // fire 'ready'. Skipping them for the common no-on_stop() child was what leaked
    // stopped children into the parent's registry.
    this._log_lifecycle('destroy', 'start');
    this.$.addClass('_Component_Stopped');

    // A component that believes it is attached is detached first, so 'detach' always
    // precedes 'stop' and subscribers can rely on strict attach/detach alternation.
    // A component that never fired 'attach' (stopped before ready, or born and kept
    // off-document) fires no 'detach' either. Either way it leaves the tracker.
    if (this._attached) this._transition_attachment(false);
    untrack_attachment(this);

    // Call user's on_stop() hook with authorization (sync) - only when actually
    // overridden, since _call_lifecycle_sync() on the base no-op costs per child
    // on every re-render.
    if (this.on_stop !== Jqhtml_Component.prototype.on_stop) {
      const stopResult = this._call_lifecycle_sync('on_stop');
      if (stopResult && typeof (stopResult as any).then === 'function') {
        console.warn(
          `[JQHTML] Component "${this.component_name()}" returned a Promise from on_stop(). ` +
          `on_stop() must be synchronous code. Remove 'async' from the function declaration.`
        );
      }
    }

    // Fire registered stop callbacks
    this.trigger('stop');

    // Remove from DOM parent's children
    if (this._dom_parent) {
      this._dom_parent._dom_children.delete(this);
    }

    this._ready_state = 99;
    this._update_debug_attrs();

    this._log_lifecycle('destroy', 'complete');
  }

  /**
   * Stop component lifecycle - stops all descendant components then self
   * Leaves DOM intact, just stops lifecycle engine and fires cleanup hooks
   */
  stop(): void {
    // Stop all descendant components (flat iteration, no recursion needed)
    this.$.find('.Component').each(function() {
      const child = $(this).data('_component');
      if (child && !child._stopped) {
        child._stop(); // Not recursive - we already have all descendants
      }
    });

    // Then stop self
    this._stop();
  }

  
  // -------------------------------------------------------------------------
  // Overridable Lifecycle Hooks
  // -------------------------------------------------------------------------

  on_render(): void {}
  on_create(): void {}
  on_load(): void | Promise<void> {}  // Override to fetch data asynchronously
  on_loaded(): void | Promise<void> {}  // Override to process loaded data (e.g., clone this.data to this.state)

  /**
   * Called when on_load() throws (or the deduplicated load this component shared
   * fails), with the error. Same access as on_load(): read this.args, write this.data.
   *
   * This base implementation prints the error. Not overriding it, the failure then
   * takes its usual course: a failed boot stops the component, a failed
   * reload()/refresh()/load() rejects. Overriding it, the component continues - it
   * renders the this.data the override leaves, then fires 'ready'. An override may call
   * super.on_load_error(error) to keep the print; one that throws stops the component.
   */
  on_load_error(error: any): void | Promise<void> {
    // Called through super from an override, `this` is the restricted on_load() context.
    const owner = (this as any)[LOAD_HOOK_OWNER] || this;
    owner._load_error_printed = { error };
    console.error(`[JQHTML] on_load() failed in ${owner.component_name()} (_cid: ${owner._cid}):`, error);
  }
  async on_ready(): Promise<void> {}
  on_stop(): void {}
  on_attach(): void {}   // Sync. Root entered the document (first checked after 'ready')
  on_detach(): void {}   // Sync. Root left the document, or the component is being stopped while attached

  // -------------------------------------------------------------------------
  // DOM attachment state machine
  // -------------------------------------------------------------------------

  /**
   * Whether this component's root is in the document right now.
   *
   * A live answer - one isConnected read - so it is correct at every point in the
   * lifecycle (including on_create()/on_load()/on_ready(), before the first 'attach')
   * and for untracked components (a natively-removed component that nothing watches
   * still answers false). A stopped component always answers false.
   *
   * It does NOT read the recorded state behind 'attach'/'detach' (_attached), and it
   * never starts tracking. The two can disagree briefly: is_attached() can be true
   * before the first 'attach' has fired, and changes a moment before the matching
   * event, since the events come from the document observer.
   *
   * Not the same as !is_stopped(): a live component can be detached (moved, not yet
   * inserted), and a stopped one answers false here even while its element is in the DOM.
   */
  is_attached(): boolean {
    return !this._stopped && !!this.$[0].isConnected;
  }

  /**
   * Whether this component has been stopped. True from the moment stop() (or _stop(),
   * reached by an ancestor's stop, a parent re-render or a jQuery removal) begins on it -
   * before on_stop() runs - and never false again.
   *
   * Code that continues after an `await` outside the lifecycle hooks (an event handler,
   * an unawaited helper, a timer) checks it before touching this.$, this.$sid(),
   * this.sid(), this.data or this.state. ready() and rendered() resolve on stop too, so
   * code after `await child.ready()` makes the same check.
   *
   * Not the same as !is_attached(): stop() leaves the DOM intact, so a stopped
   * component's element can still be in the document.
   */
  is_stopped(): boolean {
    return this._stopped;
  }

  /**
   * Flip the recorded state and fire the matching hook + event. The opposite
   * sticky event is invalidated first, so a late subscriber only ever sees the
   * current state. Hook errors are isolated; the event still fires.
   * @private
   */
  private _transition_attachment(attached: boolean): void {
    this._attached = attached;
    const event_name = attached ? 'attach' : 'detach';
    const hook_name = attached ? 'on_attach' : 'on_detach';
    this.invalidate(attached ? 'detach' : 'attach');

    if ((this as any)[hook_name] !== Jqhtml_Component.prototype[hook_name]) {
      try {
        const result = this._call_lifecycle_sync(hook_name);
        if (result && typeof (result as any).then === 'function') {
          console.warn(
            `[JQHTML] Component "${this.component_name()}" returned a Promise from ${hook_name}(). ` +
            `${hook_name}() must be synchronous code. Remove 'async' from the function declaration.`
          );
        }
      } catch (error) {
        console.error(`[JQHTML] Error in ${hook_name}() for ${this.component_name()}:`, error);
      }
    }

    this.trigger(event_name);
  }

  /**
   * Compare the root's live connectivity with the recorded state and transition
   * on a difference. Idempotent. Called by the document observer on every
   * mutation batch for tracked components, and directly by the framework after
   * 'ready' and when interest is registered late.
   * @private
   */
  _attachment_check(): void {
    if (this._stopped) return;
    const connected = !!this.$[0].isConnected;
    if (connected !== this._attached) this._transition_attachment(connected);
  }

  /**
   * The first check, run once the 'ready' handlers have completed. Fires 'attach'
   * if the component was born attached, even with no listener, so a later
   * .on('attach') gets the sticky fire. Deferred interest starts tracking here.
   * @private
   */
  private _attachment_first_check(): void {
    const first = !this._attachment_checked;
    this._attachment_checked = true;
    this._attachment_check();
    if (first && this._attachment_tracking) track_attachment(this);
  }

  /**
   * Register interest in attach/detach. Before the first ready check this only
   * records the interest; after it, tracking starts immediately and a check runs
   * at once, so a late subscriber on a natively-removed component sees 'detach'.
   * @private
   */
  private _watch_attachment(): void {
    if (this._attachment_tracking) return;
    this._attachment_tracking = true;
    if (this._attachment_checked && !this._stopped) {
      track_attachment(this);
      this._attachment_check();
    }
  }

  /**
   * Called with the viewport width in CSS pixels:
   *   - after every on_render()
   *   - after every on_ready()
   *   - on window resize, debounced 30ms, for every component in the document
   *
   * MUST be synchronous. Prefer CSS media/container queries for pure styling -
   * override this only when layout requires imperative measurement.
   */
  on_viewport_resize(viewport_width: number): void {}

  /**
   * Optional: Override cache key generation
   *
   * By default, cache keys are generated from component name + args.
   * Override this method to provide a custom cache key for this component instance.
   *
   * If this method throws an error, caching will be disabled for this component.
   *
   * @returns Custom cache key string (will be prefixed with component name)
   */
  cache_id?(): string;

  /**
   * Should component re-render after load?
   * By default, only re-renders if data has changed
   * Override to control re-rendering behavior
   */
  /**
   * Internal method to determine if component should re-render after on_load()
   * @private
   */
  _should_rerender(): boolean {
    // HTML CACHE MODE - If we used cached HTML, always re-render to get live components
    if (this._used_cached_html) {
      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Cache html] Component ${this._cid} (${this.component_name()}) forcing re-render after cached HTML`
        );
      }
      // Clear the flag
      this._used_cached_html = false;
      return true;
    }

    // OPTIMIZATION: If no custom on_load(), data cannot change, skip serialization
    // Data is frozen after on_create() and only unfrozen during on_load()
    if (!this.__has_custom_on_load) {
      return false;
    }

    // Compare current data state with data state before initial render
    const currentDataState = this._data_text();
    const dataChanged = this._data_before_render !== currentDataState;

    // Update stored state for next comparison
    if (dataChanged) {
      this._data_before_render = currentDataState;
    }

    return dataChanged;
  }
  
  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  
  /**
   * Get component name for debugging
   */
  /**
   * The name this component was invoked as - the tag written in the template
   * (<User_Card> -> 'User_Card'), the name given to $(el).component('User_Card'),
   * or the boot placeholder's data-component-init-name. For a template-only
   * component this is the template name, not 'Jqhtml_Component'. Falls back to
   * the class's static component_name, then its JS class name.
   */
  component_name(): string {
    return this._component_name;
  }

  /**
   * Register event callback - delegates to component-events.ts
   * @see component-events.ts for full documentation
   */
  on(event_name: string, callback: (this: Jqhtml_Component, component: Jqhtml_Component, data?: any) => void): this {
    if (event_name === 'attach' || event_name === 'detach') this._watch_attachment();
    return event_on(this, event_name, callback);
  }

  /**
   * Register a callback that fires exactly once - delegates to component-events.ts
   * If the event already occurred, fires immediately and does not register.
   * @see component-events.ts for full documentation
   */
  once(event_name: string, callback: (this: Jqhtml_Component, component: Jqhtml_Component, data?: any) => void): this {
    if (event_name === 'attach' || event_name === 'detach') this._watch_attachment();
    return event_once(this, event_name, callback);
  }

  /**
   * Trigger a lifecycle event - delegates to component-events.ts
   * @see component-events.ts for full documentation
   *
   * 'ready' is special: once its handlers have run, the component runs its first
   * attachment check (and every later one, idempotently). Doing it here rather than
   * at each of the call sites that trigger 'ready' guarantees the order
   * on_ready() -> 'ready' handlers -> 'attach', so everything on_ready() set up is
   * complete before anyone learns the component is in the document.
   */
  trigger(event_name: string, data?: any): void {
    event_trigger(this, event_name, data);
    if (event_name === 'ready' && !this._stopped) this._attachment_first_check();
  }

  /**
   * Check if any callbacks are registered for a given event
   */
  _on_registered(event_name: string): boolean {
    return event_on_registered(this, event_name);
  }

  /**
   * Invalidate a lifecycle event - delegates to component-events.ts
   * @see component-events.ts for full documentation
   */
  invalidate(event_name: string): void {
    event_invalidate(this, event_name);
  }

  /**
   * Find element by scoped ID
   *
   * Searches for elements with id="local_id:THIS_COMPONENT_CID"
   *
   * Example:
   *   Template: <button $sid="save_btn">Save</button>
   *   Rendered: <button id="save_btn:abc123" data-sid="save_btn">Save</button>
   *   Access:   this.$sid('save_btn')  // Returns jQuery element
   *
   * Performance: Uses native document.getElementById() when component is in DOM,
   * falls back to jQuery.find() for components not yet attached to DOM.
   *
   * @param local_id The local ID (without _cid suffix)
   * @returns jQuery element with id="local_id:_cid", or empty jQuery object if not found
   */
  $sid(local_id: string): any {
    const scopedId = `${local_id}:${this._cid}`;

    // Try getElementById first (fast path - works when component is in DOM)
    const el = document.getElementById(scopedId);

    if (el) {
      return $(el);
    }

    // Fallback: component not in DOM yet, search within component subtree
    // This allows $sid() to work on components before they're appended to body
    // Must escape the ID because it contains ':' which jQuery treats as a pseudo-selector
    return this.$.find(`#${$.escapeSelector(scopedId)}`);
  }
  
  /**
   * Get component instance by scoped ID
   *
   * Convenience method that finds element by scoped ID and returns the component instance.
   *
   * Example:
   *   Template: <User_Card $sid="active_user" />
   *   Access:   const user = this.sid('active_user');  // Returns User_Card instance
   *             user.data.name  // Access component's data
   *
   * To get the scoped ID string itself:
   *   this.$sid('active_user').attr('id')  // Returns "active_user:abc123xyz"
   *
   * @param local_id The local ID (without _cid suffix)
   * @returns Component instance or null if not found or not a component
   */
  sid(local_id: string): Jqhtml_Component | null {
    const element = this.$sid(local_id);
    const component = element.data('_component');

    // If no component found but element exists, warn developer
    if (!component && element.length > 0) {
      console.warn(
        `Component ${this.constructor.name} tried to call .sid('${local_id}') - ` +
        `${local_id} exists, however, it is not a component or $redrawable. ` +
        `Did you forget to add $redrawable to the tag?`
      );
    }

    return component || null;
  }

  /**
   * Get the component that instantiated this component (rendered it in their template)
   * Returns null if component was created programmatically via $().component()
   */
  instantiator(): Jqhtml_Component | null {
    return this._instantiator;
  }
  
  /**
   * Find descendant components by CSS selector
   */
  find(selector: string): Jqhtml_Component[] {
    const components: Jqhtml_Component[] = [];

    this.$.find(selector).each((_: number, el: HTMLElement) => {
      const comp = $(el).data('_component');
      if (comp instanceof Jqhtml_Component) {
        components.push(comp);
      }
    });

    return components;
  }

  /**
   * Find closest ancestor component matching selector
   *
   * A bare component name - a plain identifier starting with a capital letter,
   * optionally preceded by a single underscore, such as 'Parent_Dashboard' or
   * '_Root_Layout' - is treated as the component-name class
   * selector '.Parent_Dashboard'. Components carry a CSS class for every name
   * in their prototype chain, so a base class name matches its subclasses too.
   * Every other selector ('.Foo', '#id', '[attr]', 'div > .Component') is
   * passed to jQuery unchanged.
   */
  closest(selector: string): Jqhtml_Component | null {
    const search = Jqhtml_Component.COMPONENT_NAME_PATTERN.test(selector)
      ? `.${selector}`
      : selector;

    let current = this.$.parent();

    while (current.length > 0) {
      if (current.is(search)) {
        const comp = current.data('_component');
        if (comp instanceof Jqhtml_Component) {
          return comp;
        }
      }
      current = current.parent();
    }

    return null;
  }
  
  // -------------------------------------------------------------------------
  // Static Methods
  // -------------------------------------------------------------------------
  
  /**
   * Get CSS class hierarchy for this component type
   */
  static get_class_hierarchy(): string[] {
    // v2.2.13 - Fixed to handle undefined values in prototype chain
    const classes: string[] = [];
    let ctor: any = this;

    while (ctor) {
      // Check if constructor has a valid name property
      if (!ctor.name || typeof ctor.name !== 'string') {
        // console.warn('[JQHTML v2.2.13] Invalid constructor name in hierarchy:', ctor);
        break;
      }

      // Only add valid class names (non-empty strings, not 'Object')
      if (ctor.name !== 'Object' && ctor.name !== '') {
        // Normalize base class names - handle different import patterns
        let normalizedName = ctor.name;
        if (normalizedName === '_Jqhtml_Component' || normalizedName === '_Base_Jqhtml_Component') {
          normalizedName = 'Component';  // Use 'Component' instead of 'Jqhtml_Component' for CSS class
        } else if (normalizedName === 'Jqhtml_Component') {
          normalizedName = 'Component';  // Use 'Component' instead of 'Jqhtml_Component' for CSS class
        }
        classes.push(normalizedName);
      }

      // Get the next prototype
      const nextProto = Object.getPrototypeOf(ctor);

      // Stop if we've reached the end of the chain
      if (!nextProto || nextProto === Object.prototype || nextProto.constructor === Object) {
        break;
      }

      ctor = nextProto;
    }

    return classes;
  }
  
  // -------------------------------------------------------------------------
  // Private Implementation
  // -------------------------------------------------------------------------
  
  private _generate_cid(): string {
    return uid();
  }

  /**
   * Re-scope every scoped id in an HTML-cache snapshot so it belongs to THIS instance.
   *
   * A snapshot is the inner HTML of some component instance, so it contains ids of the
   * form `<name>:<cid>`: the snapshotting component's own elements carry its cid, and
   * elements rendered by nested children carry each child's cid. Replayed verbatim into
   * a second instance those ids are duplicates of the originals, and $sid() resolves via
   * getElementById(), which returns whichever matching element is first in the document -
   * so one instance could read and write another instance's DOM.
   *
   * Mapping: the snapshot owner's cid becomes this._cid (so $sid() finds the elements
   * this component is about to treat as its own), and every other cid becomes a fresh
   * uid(), consistently within one injection. Two instances hydrated from one snapshot
   * therefore share no id at all.
   *
   * The ':' separator is written only by the compiler ($sid) and the instruction
   * processor (a scoped plain id), and cids are uid() output - [a-z][a-z0-9]* - so the
   * pattern is exact. A plain unscoped id has no ':' and is left alone.
   *
   * data-cid is the debug mirror of a component's own _cid (config.ts debug_attributes).
   * The snapshot's values are stale cids belonging to components that no longer exist,
   * so they go through the same mapping rather than being left to lie in DevTools.
   *
   * @private
   */
  private _rescope_cached_html(snapshot: { cid: string; html: string }): string {
    const cid_map = new Map<string, string>();
    cid_map.set(snapshot.cid, this._cid);

    const remap = (old_cid: string): string => {
      let new_cid = cid_map.get(old_cid);
      if (new_cid === undefined) {
        new_cid = uid();
        cid_map.set(old_cid, new_cid);
      }
      return new_cid;
    };

    return snapshot.html
      // id="<name>:<cid>" - the name half may itself contain ':' (an author-written
      // id="a:b" is scoped as "a:b:cid"), so the cid is anchored at the end.
      .replace(/ id="([^"]*):([a-z][a-z0-9]*)"/g,
               (_match, name, old_cid) => ` id="${name}:${remap(old_cid)}"`)
      .replace(/ data-cid="([a-z][a-z0-9]*)"/g,
               (_match, old_cid) => ` data-cid="${remap(old_cid)}"`);
  }

  private _apply_css_classes(): void {
    const hierarchy = class_hierarchy_of(this.constructor as typeof Jqhtml_Component);

    // If component name differs from class name, add component name to hierarchy
    // This happens when:
    // 1. Using base Jqhtml_Component with _component_name
    // 2. Using parent class via extends chain (e.g., Contacts_DataGrid using DataGrid_Abstract class)
    const classesToAdd = [...hierarchy];
    if (this.args._component_name && this.args._component_name !== this.constructor.name) {
      // Add component name at the beginning (most specific)
      classesToAdd.unshift(this.args._component_name);
    }

    // Filter out private/mangled classes (starting with _) and invalid class names.
    // A component name with the reserved single-underscore prefix (_Root_Layout)
    // is public and is kept - see component-name.ts.
    const publicClasses = classesToAdd.filter(className => {
      // Guard against undefined, null, or non-string values
      if (!className || typeof className !== 'string') {
        console.warn('[JQHTML] Filtered out invalid class name:', className);
        return false;
      }
      return !className.startsWith('_') || is_component_name(className);
    });

    if (publicClasses.length > 0) {
      this.$.addClass(publicClasses.join(' '));
    }
  }

  private _apply_default_attributes(templateChain: any[]): void {
    // templateChain is resolve_template_chain() for this component, farthest ancestor
    // first: the SAME chain the constructor merged the $ arg defaults (defineArgs)
    // from. It follows resolve_parent_template(), the helper the slot-only render path
    // uses, so a <Define>'s class/attrs resolve through EXACTLY the chain its markup
    // does - extends= and the JS prototype chain, slot-only JS subclasses included.
    if (templateChain.length === 0) return;

    const debug_enabled = (window as any).jqhtml?.debug?.enabled;

    // Merge the chain into ONE set of defaults, farthest ancestor first, each nearer
    // template overriding: child <Define> > parent <Define> > grandparent, and so on.
    // The merged set is then applied once, behind the invocation attributes, so the
    // full precedence is invocation > child Define > parent Define.
    //
    // (Applying each template in turn with "only if not already set" made the PARENT's
    // value win whenever two <Define>s set the same key.)
    //
    // Keyed by slot: 'class', 'style', '$<arg>' for $foo / data-foo (both spellings are
    // the same arg, so a child data-foo overrides a parent $foo and vice versa), and the
    // attribute name for everything else. A Map keeps the slot where the farthest
    // template first set it, so attribute order on the element is unchanged.
    const merged = new Map<string, { key: string; value: any }>();

    for (const tmpl of templateChain) {
      if (!tmpl.defaultAttributes) continue;

      // Filter out 'tag' since it determines tag name, not an attribute
      const defineAttrs = { ...tmpl.defaultAttributes };
      delete defineAttrs.tag;

      if (debug_enabled) {
        const componentName = tmpl.name || this.args._component_name || this.constructor.name;
        console.log(`[Component] Collecting defaultAttributes from ${componentName}:`, defineAttrs);
      }

      // Within ONE <Define>, the first spelling of an arg wins ($foo then data-foo), as
      // it always has; only a nearer template overrides.
      const claimed = new Set<string>();

      for (const [key, value] of Object.entries(defineAttrs)) {
        let slot: string;
        let slot_value: any = value;

        if (key === 'class') {
          // Class MERGES: farther templates' classes first, nearer ones appended,
          // de-duplicated - exactly the order the per-template application produced.
          slot = 'class';
          const prev = merged.get(slot);
          if (prev && prev.value) {
            const classes = String(prev.value).split(/\s+/).filter(c => c);
            for (const newClass of String(value).split(/\s+/).filter(c => c)) {
              if (!classes.includes(newClass)) classes.push(newClass);
            }
            slot_value = classes.join(' ');
          }
        } else if (key === 'style') {
          // Style merges per property; the nearer template's value wins.
          slot = 'style';
          const prev = merged.get(slot);
          if (prev && prev.value) {
            slot_value = merge_style(String(prev.value), String(value), true);
          }
        } else if (key.startsWith('$') || key.startsWith('data-')) {
          slot = '$' + (key.startsWith('$') ? key.substring(1) : key.substring(5));
        } else {
          slot = key;
        }

        if (claimed.has(slot)) continue;
        claimed.add(slot);
        merged.set(slot, { key, value: slot_value });
      }
    }

    if (merged.size === 0) return;

    if (debug_enabled) {
      const componentName = this.args._component_name || this.constructor.name;
      const summary: Record<string, any> = {};
      for (const { key, value } of merged.values()) summary[key] = value;
      console.log(`[Component] Applying merged defaultAttributes for ${componentName}:`, summary);
    }

    // Apply the merged defaults behind the invocation attributes
    for (const { key, value } of merged.values()) {
      if (key === 'class') {
        // Special handling for class - merge with existing
        const existingClasses = this.$.attr('class');
        if (existingClasses) {
          const existing = existingClasses.split(/\s+/).filter(c => c);
          const newClasses = String(value).split(/\s+/).filter(c => c);
          for (const newClass of newClasses) {
            if (!existing.includes(newClass)) {
              existing.push(newClass);
            }
          }
          this.$.attr('class', existing.join(' '));
        } else {
          this.$.attr('class', value);
        }
      } else if (key === 'style') {
        // Special handling for style - merge with existing
        // Define attributes are applied AFTER invocation attributes
        // So we only add Define style properties that don't already exist
        // This ensures invocation wins conflicts (invocation overrides Define)
        const existingStyle = this.$.attr('style');
        if (existingStyle) {
          // Only add Define properties the invocation does not set (invocation wins)
          this.$.attr('style', merge_style(existingStyle, String(value), false));
        } else {
          this.$.attr('style', value);
        }
      } else if (key.startsWith('$') || key.startsWith('data-')) {
        // Data attributes - also update args
        const dataKey = key.startsWith('$') ? key.substring(1) : key.substring(5);

        // Only apply if not already set in args (the invocation set it)
        if (!(dataKey in this.args)) {
          this.args[dataKey] = value;
          this.$.data(dataKey, value);
          this.$.attr(key.startsWith('$') ? `data-${dataKey}` : key, String(value));
        }
      } else {
        // Regular attributes - apply directly if not already set.
        // === undefined, not falsy: tabindex="0" and an empty-string attribute
        // written at the invocation are SET, and a Define default must not win.
        if (this.$.attr(key) === undefined) {
          this.$.attr(key, value);
        }
      }
    }
  }

  private _set_attributes(): void {
    // data-cid on the rendered element is debug-only: it mirrors this._cid so component
    // boundaries are legible in DevTools. The runtime never reads it - scoping uses the
    // _cid property, and the transient data-cid placeholder the instruction processor
    // matches on is written and removed before this ever runs.
    if (debug_attributes_enabled()) {
      this.$.attr('data-cid', this._cid);
    }

    // Only set lifecycle state attribute if verbose mode enabled
    if ((window as any).jqhtml?.debug?.verbose) {
      this.$.attr('data-_lifecycle-state', this._ready_state.toString());
    }
  }

  private _update_debug_attrs(): void {
    // Only update lifecycle state attribute if verbose mode enabled
    if ((window as any).jqhtml?.debug?.verbose) {
      this.$.attr('data-_lifecycle-state', this._ready_state.toString());
    }
  }
  
  private _find_dom_parent(): void {
    let current = this.$.parent();

    while (current.length > 0) {
      const parent = current.data('_component');
      if (parent instanceof Jqhtml_Component) {
        this._dom_parent = parent;
        parent._dom_children.add(this);
        // The nearest component ancestor has already resolved skip_cache_read from its
        // own ancestry, so inheriting from it covers the whole chain
        if (parent._skip_cache_read) {
          this._skip_cache_read = true;
        }
        break;
      }
      current = current.parent();
    }
  }

  /**
   * Get DOM children (components in DOM subtree)
   * Uses fast _dom_children registry when possible, falls back to DOM traversal for off-DOM components
   * @private - Used internally for lifecycle coordination
   */
  private _get_dom_children(): Jqhtml_Component[] {
    // If component was off-DOM during render, children couldn't register via _find_dom_parent()
    // Use DOM traversal to find direct children (works off-DOM, slightly slower)
    if (this._use_dom_fallback) {
      const directChildren: Jqhtml_Component[] = [];

      this.$.find('.Component').each((_: number, el: HTMLElement) => {
        const $el = $(el);
        const comp = $el.data('_component');

        if (comp instanceof Jqhtml_Component) {
          // Only include if this component is the direct parent (not a grandparent)
          // Check: closest parent component is us (or no parent = we're the root)
          const closestParent = $el.parent().closest('.Component');
          if (closestParent.length === 0 || closestParent.data('_component') === this) {
            directChildren.push(comp);
          }
        }
      });

      return directChildren;
    }

    // Fast path: component was in-DOM during render, children registered normally
    // Filter out any that have since been removed from DOM (destroyed/replaced)
    const children = Array.from(this._dom_children);
    return children.filter(child => {
      return $.contains(document.documentElement, child.$[0]);
    });
  }

  private _log_lifecycle(phase: string, status: string): void {
    // Nothing to log: no lifecycle logging flag and no legacy JQHTML_DEBUG hook. Runs
    // several times per component per render, so this is checked before any call.
    // Without window.jqhtml it falls through, so logLifecycle() still reports that.
    const has_window = typeof window !== 'undefined';
    const debug = has_window ? (window as any).jqhtml?.debug : undefined;
    const legacy = has_window ? window.JQHTML_DEBUG : undefined;
    if (debug && !debug.logFullLifecycle && !debug.logCreationReady && !legacy) return;

    // Use new debug module
    logLifecycle(this, phase, status as 'start' | 'complete');
    
    // Keep legacy support for window.JQHTML_DEBUG
    if (legacy) {
      window.JQHTML_DEBUG.log(this.component_name(), phase, status, {
        cid: this._cid,
        ready_state: this._ready_state,
        args: this.args
      });
    }
  }

}

// The base on_viewport_resize() no-op, for the identity check that lets the lifecycle
// and the resize dispatcher skip components that do not override it.
export const base_on_viewport_resize = Jqhtml_Component.prototype.on_viewport_resize;

// The base get_class_hierarchy(), for the identity check in class_hierarchy_of().
const base_get_class_hierarchy = Jqhtml_Component.get_class_hierarchy;
