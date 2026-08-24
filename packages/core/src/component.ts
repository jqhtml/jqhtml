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
import { get_template_by_class, get_template } from './component-registry.js';
import { process_instructions, uid } from './instruction-processor.js';
import { logLifecycle, applyDebugDelay, handleComponentError } from './debug.js';
import { Load_Coordinator } from './load-coordinator.js';
import { Jqhtml_Local_Storage } from './local-storage.js';
import { event_on, event_once, event_trigger, event_on_registered, event_invalidate } from './component-events.js';
import { setup_data_property, execute_on_load_detached } from './data-proxy.js';
import { read_cache_in_create, check_cache_on_reload, write_html_cache_snapshot, write_cache_on_loaded } from './component-cache.js';
import { debug_attributes_enabled } from './config.js';
import { Component_Queue } from './component-queue.js';
import { capture_component_data, is_capture_enabled, consume_preload_data, has_preload_data } from './preload-data.js';
import { get_viewport_width } from './viewport.js';

// WeakMap storage for protected lifecycle method implementations (Option 2)
// See docs/internal/lifecycle-method-protection.md for design details
const lifecycle_impls = new WeakMap<Jqhtml_Component, Record<string, Function>>();

// Extend window for debug capabilities
declare global {
  interface Window {
    JQHTML_DEBUG?: {
      log: (componentName: string, phase: string, message: string, data?: any) => void;
      updateTree: () => void;
    };
  }
}

export class Jqhtml_Component {
  // Static properties
  static __jqhtml_component = true;       // Marker for unified register() detection
  static template?: any;                  // Template associated with this component class

  // A bare component name, as accepted by closest() in place of a class selector
  static readonly COMPONENT_NAME_PATTERN = /^[A-Z][A-Za-z0-9_]*$/;

  // Public properties
  $: any;                                 // Component's root jQuery element
  args: Record<string, any>;              // Arguments passed to component
  data: Record<string, any>;              // Component's data store (initialized via defineProperty in constructor)
  state: Record<string, any>;             // Arbitrary component state (convention, no special framework behavior)
  _cid: string;                           // Component instance ID for scoping
  _ready_state: number = 0;               // 0=created, 1=init, 2=loaded, 3=rendered, 4=ready

  // Private properties
  private _lifecycle_manager: LifecycleManager;
  private _instantiator: Jqhtml_Component | null = null;  // Component that instantiated this one
  private _dom_parent: Jqhtml_Component | null = null;    // Closest component in DOM tree (for lifecycle)
  private _dom_children: Set<Jqhtml_Component> = new Set();  // Components in DOM subtree (for lifecycle)
  private _use_dom_fallback: boolean = false;  // If true, use find() fallback instead of _dom_children optimization
  private _stopped: boolean = false;
  private _booted: boolean = false;  // Guard to prevent double boot() calls
  private _data_before_render: string | null = null;  // Store data state before initial render
  private _lifecycle_callbacks: Map<string, Array<(component: Jqhtml_Component) => void>> = new Map();
  private _lifecycle_states: Map<string, any> = new Map();  // Track which lifecycle events have occurred and their data
  private _did_first_render: boolean = false;  // Track if component has rendered at least once
  private _render_count: number = 0;  // Incremented each time _render() is called, used to detect stale renders
  private _args_on_last_render: Record<string, any> | null = null;  // Args snapshot from last render (for reload() comparison)
  private _data_on_last_render: string | null = null;  // Data snapshot from last render (for refresh() comparison)
  private __initial_data_snapshot: Record<string, any> | null = null;  // Snapshot of this.data after on_create() for restoration before on_load()
  private __data_frozen: boolean = false;  // Track if this.data is currently frozen
  private _queue: Component_Queue = new Component_Queue();  // Lifecycle operation queue (render/reload/refresh)
  private next_reload_force_refresh: boolean | null = null;  // State machine for reload()/refresh() debounce precedence
  private __lifecycle_authorized: boolean = false;  // Flag for lifecycle method protection

  // Cache mode properties
  private _cache_key: string | null = null;  // Cache key for caching

  // 'html' mode caching
  private _cached_html: string | null = null;  // Cached HTML to inject on first render
  private _used_cached_html: boolean = false;  // Flag if cached HTML was used (forces re-render after on_load)
  private _should_cache_html_after_ready: boolean = false;  // Flag to cache HTML after on_ready lifecycle
  private _is_dynamic: boolean = false;  // True if this.data changed during on_load() (used for HTML cache sync)

  // on_render synchronization (HTML cache mode)
  private _on_render_complete: boolean = false;  // True after on_render() has been called post-on_load

  // use_cached_data feature - skip on_load() when cache hit occurs
  private _use_cached_data_hit: boolean = false;  // True if use_cached_data=true AND cache was used

  // _load_only: create + load only. No render, no children, no on_render, no on_loaded, no on_ready.
  private _load_only: boolean = false;

  // _load_render_only: create + render + load + re-render. No on_render, no on_loaded, no on_ready.
  private _load_render_only: boolean = false;

  // Detached optimization: true when element is not in the DOM at boot time.
  // Skips initial render and cache read — just on_load then render.
  // Override with _force_initial_render to keep normal double-render behavior.
  _is_detached: boolean = false;

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

  // gate_load() — "load gates" registered during on_create() that must settle
  // before the component's FIRST on_load() runs. See gate_load() / _await_load_gates().
  private __load_gates: Promise<any>[] = [];        // Pending gates (cleared once the first load begins)
  private __first_load_started: boolean = false;    // Latch: true once the first load phase begins (enforces one-shot + throw-after)
  private __gate_resume: (() => void) | null = null; // Resolver to release an in-progress gate wait early (reload/refresh/stop)

  constructor(element?: any, args: Record<string, any> = {}) {
    // Detect custom on_load() override immediately
    // Prototype chain is set up before constructor runs, so this.on_load
    // correctly resolves to child class override if one exists
    this.__has_custom_on_load = this.on_load !== Jqhtml_Component.prototype.on_load;

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
    
    // Get template to check for defineArgs
    let template_for_args;
    if (args._component_name) {
      template_for_args = get_template(args._component_name);
    } else {
      template_for_args = get_template_by_class(this.constructor as any);
    }

    // Merge in order: defineArgs (defaults from Define tag) < dataAttrs < args (invocation overrides)
    const defineArgs = template_for_args?.defineArgs || {};
    this.args = { ...defineArgs, ...dataAttrs, ...args };

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
    this._apply_default_attributes();  // Apply defaultAttributes from template
    this._set_attributes();

    // Find DOM parent component (for lifecycle coordination)
    this._find_dom_parent();

    // Setup data property with freeze enforcement using Proxy
    // @see data-proxy.ts for full implementation
    setup_data_property(this);

    // Initialize this.state as an empty object (convention for arbitrary component state)
    // No special meaning to framework - mutable anywhere, not cached, not frozen
    (this as any).state = {};

    this._log_lifecycle('construct', 'complete');
  }

  /**
   * Protect lifecycle methods from manual invocation
   * Stores original implementations in WeakMap, replaces with guarded wrappers
   * @private
   */
  private _protect_lifecycle_methods(): void {
    const methods: Record<string, string> = {
      on_create: 'Called automatically during creation.',
      on_render: 'Use render() to trigger a re-render.',
      on_load: 'Use reload() to refresh data.',
      on_ready: 'Called automatically when ready.',
      on_stop: 'Use stop() to stop the component.'
    };

    const impls: Record<string, Function> = {};
    const self = this;

    for (const [name, help] of Object.entries(methods)) {
      const original = (this as any)[name];
      // Skip if using base class default (empty method)
      if (original === Jqhtml_Component.prototype[name as keyof Jqhtml_Component]) continue;

      impls[name] = original;
      // Create wrapper with same function name (for stack traces)
      (this as any)[name] = {
        [name](...args: any[]) {
          if (!self.__lifecycle_authorized) {
            throw new Error(
              `[JQHTML] ${name}() cannot be called manually. ${help}\n` +
              `Component: ${self.component_name()} (_cid: ${self._cid})`
            );
          }
          return lifecycle_impls.get(self)![name].apply(self, args);
        }
      }[name];
    }

    lifecycle_impls.set(this, impls);
  }

  /**
   * Call a lifecycle method with authorization (async)
   * Framework calls this to invoke lifecycle methods, bypassing the protection wrapper.
   * The flag is set momentarily for the wrapper check, then reset BEFORE user code runs.
   * This ensures any nested lifecycle calls from user code will fail the flag check.
   * @private
   */
  private async _call_lifecycle<T>(name: string, context?: any): Promise<T | void> {
    // Get the original implementation (bypasses wrapper entirely)
    const impl = lifecycle_impls.get(this)?.[name] || (this as any)[name];
    // Call original directly - no flag needed since we bypass the wrapper
    return await impl.call(context || this);
  }

  /**
   * Call a lifecycle method with authorization (sync version for sync methods like on_stop)
   * @private
   */
  private _call_lifecycle_sync<T>(name: string): T | void {
    // Get the original implementation (bypasses wrapper entirely)
    const impl = lifecycle_impls.get(this)?.[name] || (this as any)[name];
    // Call original directly - no flag needed since we bypass the wrapper
    return impl.call(this);
  }

  /**
   * Fire on_viewport_resize() with the current viewport width.
   * Called after every on_render() and on_ready(); the debounced window
   * listener in viewport.ts drives it from then on. Errors are isolated so a
   * bad handler cannot break the lifecycle.
   * @private
   */
  private _fire_viewport_resize(): void {
    try {
      this.on_viewport_resize(get_viewport_width());
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
      // First check if element with scoped ID exists
      const $element = this.$sid(id);
      if ($element.length === 0) {
        throw new Error(
          `[JQHTML] render("${id}") - no such id.\n` +
          `Component "${this.component_name()}" has no child element with $sid="${id}".`
        );
      }

      // Element exists, check if it's a component
      const child = $element.data('_component');
      if (!child) {
        throw new Error(
          `[JQHTML] render("${id}") - element is not a component or does not have $redrawable attribute set.\n` +
          `Element with $sid="${id}" exists but is not initialized as a component.\n` +
          `Add $redrawable attribute or make it a proper component.`
        );
      }

      return child._render(null, options);
    }

    this._log_lifecycle('render', 'start');

    // HTML CACHE MODE - If we have cached HTML, inject it directly and skip template rendering
    if (this._cached_html !== null) {
      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Cache html] Component ${this._cid} (${this.component_name()}) injecting cached HTML`,
          { html_length: this._cached_html.length }
        );
      }

      // Inject cached HTML directly
      this.$[0].innerHTML = this._cached_html;

      // Mark that we used cached HTML (forces re-render after on_load)
      this._used_cached_html = true;

      // Clear cached HTML so next render uses template
      this._cached_html = null;

      // Mark first render complete
      this._did_first_render = true;

      this._log_lifecycle('render', 'complete (cached HTML)');

      // Call on_render() after cache inject (unless suppressed by _load_render_only)
      if (!options.skip_on_render) {
        const cacheRenderResult = this._call_lifecycle_sync('on_render');
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
      try {
        this._args_on_last_render = JSON.parse(JSON.stringify(this.args));
      } catch (error) {
        this._args_on_last_render = null;
      }
      this._data_on_last_render = JSON.stringify(this.data);

      return current_render_id;
    }

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

    // Remove _Component_Stopped class if present (allows re-render after stop)
    this.$.removeClass('_Component_Stopped');

    // Capture data state before first render for comparison later
    if (this._data_before_render === null) {
      this._data_before_render = JSON.stringify(this.data);
    }

    // Clear DOM children tracking - they're destroyed by innerHTML = '' anyway
    this._dom_children.clear();

    // Get template and render it
    let template_def;

    // If we have a component name, try looking up by name first (for unregistered components)
    if (this.args._component_name) {
      template_def = get_template(this.args._component_name);
    } else {
      // Otherwise look up by class
      template_def = get_template_by_class(this.constructor as any);
    }

    if (template_def && template_def.render) {
      // Create jqhtml utilities object
      const jqhtml = {
        escape_html: (str: any) => {
          const div = document.createElement('div');
          div.textContent = String(str);
          return div.innerHTML;
        },
        escape_html_nl2br: (str: any) => {
          const div = document.createElement('div');
          div.textContent = String(str);
          // Escape HTML first, then replace newlines with <br />
          return div.innerHTML.replace(/\n/g, '<br />');
        }
      };

      // Execute template function
      // Commented out debug logging
      // console.log('[Component] About to call render, this:', this);
      // console.log('[Component] this.constructor.name:', this.constructor.name);
      // console.log('[Component] this.data:', this.data);
      // console.log('[Component] this.args:', this.args);

      // Create content function that handles both default content and named slots
      const createContentFunction = () => {
        const defaultContentFn = this.args._innerhtml_function;
        const slotsObj = this.args._slots;

        // Return a function that handles both slot names and default content
        return (slotName?: string, ...slotArgs: any[]) => {
          // If slot name provided and slots object exists, try to use named slot
          if (slotName && slotsObj && slotsObj[slotName]) {
            // Call the slot function - it returns [instructions, context]
            return slotsObj[slotName](...slotArgs);
          }
          // If slot name provided but not found, return empty
          else if (slotName) {
            return '';
          }
          // No slot name = default content
          else if (defaultContentFn) {
            return defaultContentFn(this);
          }
          // No content at all
          else {
            return '';
          }
        };
      };

      const contentFunction = createContentFunction();

      let [instructions, context] = template_def.render.bind(this)(
        this.data,
        this.args,
        contentFunction, // Content function with slot support
        jqhtml // Utilities object
      );

      // Check for template inheritance (slot-only OR explicit extends)
      // If instructions is {_slots: {...}}, find parent template and invoke it
      if (instructions && typeof instructions === 'object' && instructions._slots && !Array.isArray(instructions)) {
        const componentName = template_def.name || this.args._component_name || this.constructor.name;
        console.log(`[JQHTML] Slot-only template detected for ${componentName}`);

        let parentTemplate = null;
        let parentTemplateName = null;

        // First check for explicit extends attribute in template metadata
        if (template_def.extends) {
          console.log(`[JQHTML]   Using explicit extends: ${template_def.extends}`);
          parentTemplate = get_template(template_def.extends);
          parentTemplateName = template_def.extends;
        }

        // If no explicit extends, walk the prototype chain to find parent class with template
        if (!parentTemplate) {
          let currentClass = Object.getPrototypeOf(this.constructor);

          while (currentClass && currentClass.name !== 'Object' && currentClass.name !== 'Jqhtml_Component') {
            const className = currentClass.name;
            console.log(`[JQHTML]   Checking parent: ${className}`);

            try {
              const classTemplate = get_template(className);
              if (classTemplate && classTemplate.name !== 'Jqhtml_Component') {
                console.log(`[JQHTML]   Found parent template: ${className}`);
                parentTemplate = classTemplate;
                parentTemplateName = className;
                break;
              }
            } catch (error) {
              console.warn(`[JQHTML] Error finding parent template ${className}:`, error);
            }

            currentClass = Object.getPrototypeOf(currentClass);
          }
        }

        // If we found a parent template, invoke it with child's slots
        if (parentTemplate) {
          try {
            // Create a content function that invokes child slots
            // When parent calls content('slotName'), it invokes the child's slot function
            const childSlots = instructions._slots;
            const contentFunction = (slotName: string, data?: any) => {
              if (childSlots[slotName] && typeof childSlots[slotName] === 'function') {
                // Invoke the slot function with data parameter
                const [slotInstructions, slotContext] = childSlots[slotName](data);
                // Return in render function format: [instructions, context]
                // The template expression handler expects this format
                return [slotInstructions, slotContext];
              }
              // Slot not found, return empty
              return '';
            };

            // Invoke parent template with child's slots as content function
            const [parentInstructions, parentContext] = parentTemplate.render.bind(this)(
              this.data,
              this.args,
              contentFunction, // Pass content function that invokes child slots
              jqhtml
            );

            console.log(`[JQHTML]   Parent template invoked successfully`);
            instructions = parentInstructions;
            context = parentContext;
          } catch (error) {
            console.warn(`[JQHTML] Error invoking parent template ${parentTemplateName}:`, error);
            instructions = [];
          }
        } else {
          console.warn(`[JQHTML] No parent template found for ${this.constructor.name}, rendering empty`);
          instructions = [];
        }
      }

      // Flatten any nested content instructions before processing
      // Instructions may contain ['_content', [...]] markers from content() calls
      const flattenedInstructions = this._flatten_instructions(instructions);

      // Process instructions to generate DOM
      // This kicks off child component boots but doesn't wait for them
      process_instructions(flattenedInstructions, this.$, this);
    }

    // Don't update ready state here - let phases complete in order
    this._update_debug_attrs();

    this._log_lifecycle('render', 'complete');

    // Call on_render() after render completes (unless suppressed by _load_render_only)
    if (!options.skip_on_render) {
      const renderResult = this._call_lifecycle_sync('on_render');
      if (renderResult && typeof (renderResult as any).then === 'function') {
        console.warn(
          `[JQHTML] Component "${this.component_name()}" returned a Promise from on_render(). ` +
          `on_render() must be synchronous code. Remove 'async' from the function declaration.`
        );
      }
      this._fire_viewport_resize();
    }

    // Emit lifecycle event
    this.trigger('render');

    // Apply debug delay after render
    const isRerender = this._ready_state >= 3; // Already rendered once
    applyDebugDelay(isRerender ? 'rerender' : 'render');

    // Store args snapshot for reload() comparison (skip if non-serializable)
    try {
      this._args_on_last_render = JSON.parse(JSON.stringify(this.args));
    } catch (error) {
      // Args contain circular references - skip snapshot (reload comparison will be disabled)
      this._args_on_last_render = null;
    }

    // Store data snapshot for refresh() comparison
    this._data_on_last_render = JSON.stringify(this.data);

    // HTML CACHE MODE: Mark on_render complete after second render (post-on_load)
    // This signals to parent components that this component's DOM is fully rendered
    // with fresh data and ready for HTML snapshot
    if (this._ready_state >= 2) {
      this._on_render_complete = true;
    }

    // Return the render ID so callers can check if this render is still current
    return current_render_id;
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

    // Invalidate ready event so new handlers wait for this render cycle to complete
    // This prevents .on('ready') handlers from firing immediately based on previous lifecycle
    this.invalidate('ready');

    // If id provided, delegate to child component
    if (id) {
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

      return child.render();
    }

    // Enqueue the full render lifecycle through the component queue
    // Return the queue promise so `await this.render()` resolves when the
    // full render lifecycle (DOM update, children ready, on_ready) completes
    return this._queue.enqueue('render', async () => {
      // Execute render phase synchronously and capture render ID
      const render_id = this._render();

      // Wait for all child components to be ready
      await this._wait_for_children_ready();

      // Check if this render is still current before calling on_ready
      // If _render_count changed, another render happened and we should skip on_ready
      if (this._render_count !== render_id) {
        return; // Stale render, don't call on_ready
      }

      // Call on_ready hook with authorization
      await this._call_lifecycle('on_ready');
      this._fire_viewport_resize();

      // Trigger ready event
      this.trigger('ready');
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
  async load(): Promise<boolean> {
    if (this._stopped) return false;

    // Capture result through queue closure
    let data_changed = false;

    await this._queue.enqueue('load', async () => {
      // Snapshot current data for change detection
      const data_before = JSON.stringify(this.data);

      // Execute on_load() on detached proxy (restores data to on_create snapshot)
      const { data: result_data } = await this._execute_on_load_detached(false);

      // Atomically update this.data: unfreeze → assign → normalize → refreeze
      this.__data_frozen = false;
      this.data = result_data;

      const cache_mode = Jqhtml_Local_Storage.get_cache_mode();
      if (cache_mode === 'data') {
        const normalized = Jqhtml_Local_Storage.normalize_for_cache(this.data);
        this.data = normalized;
      }

      this.__data_frozen = true;

      // Detect if data changed
      const data_after = JSON.stringify(this.data);
      data_changed = data_before !== data_after;

      // Update cache with fresh data if changed
      if (data_changed) {
        // Regenerate cache key (args may have changed since boot)
        let cache_key: string | null = null;
        if (typeof this.cache_id === 'function') {
          try {
            cache_key = `${this.component_name()}::${String(this.cache_id())}`;
          } catch { /* cache_id() threw - skip caching */ }
        } else {
          const result = Load_Coordinator.generate_invocation_key(this.component_name(), this.args);
          cache_key = result.key;
        }

        if (cache_key && cache_mode !== 'html') {
          Jqhtml_Local_Storage.set(cache_key, this.data);
        }
      }

      // Call on_loaded() on the real component (this.data frozen, full access to this.$, this.state)
      // Suppressed by _load_only and _load_render_only flags (preloading mode)
      if (!this._load_only && !this._load_render_only) {
        await this._call_lifecycle('on_loaded');
        this.trigger('loaded');
      }
    });

    return data_changed;
  }

  /**
   * Create phase - Quick setup, prepare UI
   * SYNCHRONOUS - no awaits, no yields
   */
  create(): void {
    if (this._stopped || this._ready_state >= 1) return;

    this._log_lifecycle('create', 'start');

    // Call on_create() synchronously - it MUST be synchronous
    const result = this._call_lifecycle_sync('on_create');
    if (result && typeof (result as any).then === 'function') {
      console.warn(
        `[JQHTML] Component "${this.component_name()}" returned a Promise from on_create(). ` +
        `on_create() must be synchronous code. Remove 'async' from the function declaration.`
      );
      // Don't await - on_create MUST be sync. The warning is enough.
    }

    // Detect detached elements — skip cache and initial render for elements not in DOM
    // _force_initial_render overrides this optimization
    this._is_detached = !this.$[0].isConnected && !this._force_initial_render;

    // OPTIMIZATION: Skip cache operations and snapshot if no custom on_load()
    // Components without on_load() don't fetch data, so nothing to cache or restore
    if (this.__has_custom_on_load) {
      // CACHE CHECK - Read from cache based on cache mode ('data' or 'html')
      // Skip cache for detached elements — no point hydrating from cache when not in DOM
      // @see component-cache.ts for full implementation
      if (!this._is_detached) {
        read_cache_in_create(this);
      }

      // Snapshot this.data after on_create() completes
      // This will be restored before each on_load() execution to reset state
      this.__initial_data_snapshot = JSON.parse(JSON.stringify(this.data));
    }

    // Freeze this.data after on_create() - only on_load() can modify it now
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
    let cache_key: string | null = null;
    let uncacheable_property: string | undefined;
    let uncacheable_reason: string | undefined;

    if (typeof this.cache_id === 'function') {
      try {
        const custom_cache_id = this.cache_id();
        cache_key = `${this.component_name()}::${String(custom_cache_id)}`;
      } catch (error) {
        // cache_id() threw error - disable caching
        uncacheable_property = 'cache_id()';
        uncacheable_reason = 'cache-id-threw';
      }
    } else {
      const result = Load_Coordinator.generate_invocation_key(
        this.component_name(),
        this.args,
        { allow_content_serialization: true }
      );
      cache_key = result.key;
      uncacheable_property = result.uncacheable_property;
      uncacheable_reason = result.uncacheable_reason;
    }

    const dedup_key = Load_Coordinator.generate_invocation_key(this.component_name(), this.args).key;

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

        const data_before_load = JSON.stringify(this.data);
        await this._apply_load_result(preloaded_data, data_before_load);
        return;
      }
    }

    // Store cache key for later use
    this._cache_key = cache_key;

    // Caching disabled - mark the element with the offending arg AND why
    if (cache_key === null && uncacheable_property) {
      this.$.attr(
        'data-nocache',
        uncacheable_reason ? `${uncacheable_property}:${uncacheable_reason}` : uncacheable_property
      );

      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Cache] Component ${this._cid} (${this.component_name()}) has non-keyable args - caching disabled`,
          { uncacheable_property, uncacheable_reason }
        );
      }
    }

    // Store "before" snapshot for comparison after on_load()
    const data_before_load = JSON.stringify(this.data);

    // No dedup identity - run on_load() alone rather than risk sharing a load
    if (dedup_key === null) {
      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Load Deduplication] Component ${this._cid} (${this.component_name()}) has no dedup key - loading independently`
        );
      }
      const { data: result_data } = await this._execute_on_load_detached();
      await this._apply_load_result(result_data, data_before_load);
      return;
    }

    // Check if this component should execute on_load() or wait for existing request
    const should_execute = Load_Coordinator.should_execute_on_load(this);

    if (!should_execute) {
      // This component is a follower - wait for leader to complete
      if ((window as any).jqhtml?.debug?.verbose) {
        console.log(
          `[Load Deduplication] Component ${this._cid} (${this.component_name()}) is a follower, waiting for leader`,
          { args: this.args }
        );
      }

      const coordination_promise = Load_Coordinator.get_coordination_promise(this);
      if (coordination_promise) {
        try {
          // Wait for leader to complete
          await coordination_promise;

          // Retrieve leader's data from coordinator
          const leader_data = Load_Coordinator.get_leader_data(this);

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
        } catch (error) {
          // Leader failed - error will propagate naturally
          console.error(
            `[Load Deduplication] Component ${this._cid} failed due to leader error:`,
            error
          );
          throw error;
        }
      }

      // Fallback: if we couldn't get leader data, just mark as complete
      this._ready_state = 2;
      this._update_debug_attrs();
      this._log_lifecycle('load', 'complete (follower)');
      this.trigger('load');
      if (!this._load_only && !this._load_render_only) {
        await this._call_lifecycle('on_loaded');
        this.trigger('loaded');
      }
      return;
    }

    // This component is a leader - execute on_load() on detached proxy
    if ((window as any).jqhtml?.debug?.verbose) {
      console.log(
        `[Load Deduplication] Component ${this._cid} (${this.component_name()}) is the leader`,
        { args: this.args }
      );
    }

    // Execute on_load on detached proxy with Load_Coordinator registration
    const { data: result_data, complete_coordination } = await this._execute_on_load_detached(true);

    // Apply result via sequential queue
    await this._apply_load_result(result_data, data_before_load);

    // Complete coordination AFTER this.data is updated
    // This ensures followers receive the correct final data
    if (complete_coordination) {
      complete_coordination(this.data);
    }
  }

  /**
   * Execute on_load() on a fully detached proxy.
   * @see data-proxy.ts for full implementation
   * @private
   */
  private async _execute_on_load_detached(use_load_coordinator: boolean = false): Promise<{
    data: Record<string, any>;
    complete_coordination: ((data: Record<string, any>) => void) | null;
  }> {
    return execute_on_load_detached(this, use_load_coordinator);
  }

  /**
   * Apply the result of on_load() to this.data via the sequential queue.
   *
   * Multiple _load calls can execute on_load in parallel, but this method
   * ensures that setting this.data happens in FIFO order.
   *
   * @param result_data - The data returned from _execute_on_load_detached
   * @param data_before_load - JSON string of this.data before on_load (for change detection), or null
   * @private
   */
  private async _apply_load_result(result_data: Record<string, any>, data_before_load: string | null): Promise<void> {
    // Queue this operation - wait for any earlier _load calls to finish setting data
    const my_turn = this._load_queue;

    let resolve_my_turn: () => void;
    this._load_queue = new Promise<void>((resolve) => {
      resolve_my_turn = resolve;
    });

    // Wait for our turn
    await my_turn;

    try {
      // Now it's our turn to set this.data

      // Unfreeze, set data, freeze
      this.__data_frozen = false;
      this.data = result_data;

      // DATA MODE: Normalize this.data through serialize/deserialize round-trip
      // This ensures "hot" data (fresh from on_load) behaves identically to "cold" data
      const cache_mode = Jqhtml_Local_Storage.get_cache_mode();
      if (cache_mode === 'data') {
        const normalized = Jqhtml_Local_Storage.normalize_for_cache(this.data);
        this.data = normalized;

        if ((window as any).jqhtml?.debug?.verbose) {
          console.log(
            `[Cache data] Component ${this._cid} (${this.component_name()}) normalized this.data after on_load()`,
            { data: this.data }
          );
        }
      }

      // Freeze this.data
      this.__data_frozen = true;

      // SSR data capture: record this component's data for preloading
      if (is_capture_enabled() && this._has_on_load()) {
        capture_component_data(
          this.component_name(),
          this.args,
          this.data,
          this._cache_key
        );
      }

      // Calculate if data changed
      const data_after_load = JSON.stringify(this.data);
      const data_changed = data_before_load !== null && data_after_load !== data_before_load;

      // Track if component is "dynamic" (this.data changed during on_load)
      // Used by HTML cache mode for synchronization - static parents don't block children
      this._is_dynamic = data_changed && data_after_load !== '{}';

      // CACHE WRITE - @see component-cache.ts
      write_cache_on_loaded(this, this._is_dynamic);

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
    if (this._should_cache_html_after_ready && this._cache_key) {
      await this._wait_for_children_on_render();
      write_html_cache_snapshot(this);
    }

    // Wait for all children to reach ready state (bottom-up execution)
    await this._wait_for_children_ready();

    await this._call_lifecycle('on_ready');
    this._fire_viewport_resize();

    this._ready_state = 4;
    this._update_debug_attrs();

    this._log_lifecycle('ready', 'complete');

    // Emit lifecycle event
    this.trigger('ready');
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

    // Return promise that resolves when ready event fires
    return new Promise<void>((resolve) => {
      this.on('ready', () => {
        if (callback) callback();
        resolve();
      });
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
    return new Promise<void>((resolve) => {
      this.on('rendered', () => {
        if (callback) callback();
        resolve();
      });
    });
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

      // Create promise that resolves when child reaches ready
      const ready_promise = new Promise<void>((resolve) => {
        child.on('ready', () => resolve());
      });

      ready_promises.push(ready_promise);
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
      // If child already completed on_render post-on_load, skip
      if (child._on_render_complete) {
        continue;
      }

      // Create promise that resolves when child completes on_render
      const render_promise = new Promise<void>((resolve) => {
        // Poll for completion (simple approach - could use events for more efficiency)
        const check = () => {
          if (child._on_render_complete || child._stopped) {
            resolve();
          } else {
            setTimeout(check, 10);
          }
        };
        check();
      });

      render_promises.push(render_promise);
    }

    // Wait for all children to complete on_render
    await Promise.all(render_promises);
  }


  /**
   * Reload component - re-fetch data and re-render (debounced)
   *
   * This is the public API that automatically debounces calls to _reload()
   * Multiple rapid calls to reload() will be coalesced into a single execution
   *
   * @param always_render - If true (default), always re-render after on_load().
   *                        If false, only re-render if data actually changed.
   */
  async reload(always_render?: boolean): Promise<void> {
    // Load-gate short-circuit: if a gate is currently holding the first on_load,
    // reload()/refresh() resumes the paused boot lifecycle instead of running its
    // normal debounced re-fetch. The boot lifecycle then proceeds to run on_load
    // (the fresh fetch) exactly as reload() would want. Any later gate settlement
    // becomes a no-op. Return a promise that resolves when the component is ready.
    if (this.__gate_resume) {
      const resume = this.__gate_resume;
      this.__gate_resume = null;
      resume();
      return this.ready();
    }

    // Default to true if undefined
    const force_refresh = always_render !== undefined ? always_render : true;

    // State machine: reload(true) takes precedence over reload(false)
    if (force_refresh) {
      this.next_reload_force_refresh = true;
    } else {
      // Only set to false if not already true
      if (this.next_reload_force_refresh !== true) {
        this.next_reload_force_refresh = false;
      }
    }

    // Enqueue through component queue (replaces _create_debounced_function)
    // Same-type pending operations collapse (multiple reload() calls share one execution)
    return this._queue.enqueue('reload', () => this._reload());
  }

  /**
   * Refresh component - re-fetch data and re-render only if data changed (debounced)
   *
   * Similar to reload() but only re-renders if the data actually changed after on_load().
   * Useful for checking server for updates without forcing unnecessary re-renders.
   *
   * Uses the same debouncing as reload() and plays nice with it - if reload() is called
   * while refresh() is queued, reload() takes precedence and will always render.
   */
  async refresh(): Promise<void> {
    return this.reload(false);
  }

  /**
   * Internal reload implementation - re-fetch data and re-render
   *
   * COMPLETE RELOAD PROCESS (Source of Truth):
   *
   * STEP 1: Cache check (if args changed since last render)
   *   - Generate cache key from component name + current args
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
   *   - If data changed and non-empty: write to cache
   *
   * STEP 3: Conditionally re-render
   *   - If didn't render from cache yet, OR data changed after on_load():
   *     - Call render() to update DOM
   *
   * STEP 3.5: Wait for all children to be ready
   *   - Bottom-up ordering (children ready before parent)
   *   - Same as main lifecycle
   *
   * STEP 4: Call on_ready()
   *   - Always call on_ready() after reload completes
   *
   * @private - Use reload() instead (debounced wrapper)
   */
  async _reload(): Promise<void> {
    if (this._stopped) return;

    // Invalidate ready event so new handlers wait for this reload to complete
    // This prevents .on('ready') handlers from firing immediately based on previous lifecycle
    this.invalidate('ready');

    this._log_lifecycle('reload', 'start');

    // OPTIMIZATION: If no custom on_load(), skip data fetching entirely
    // Just re-render with current data and call on_ready
    if (!this.__has_custom_on_load) {
      // Reset state machine
      this.next_reload_force_refresh = null;

      this._render();
      await this._wait_for_children_ready();
      await this._call_lifecycle('on_ready');
      this._fire_viewport_resize();
      this.trigger('ready');

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
        args_changed = JSON.stringify(this.args) !== JSON.stringify(this._args_on_last_render);
      } catch (error) {
        // Args contain circular references - cannot detect change, assume changed
        args_changed = true;
      }
    }

    if (args_changed) {
      // @see component-cache.ts for full implementation
      rendered_from_cache = check_cache_on_reload(this);
    }

    // Capture data state before on_load for comparison
    data_before_load = JSON.stringify(this.data);

    // STEP 2: Call on_load() on detached proxy
    // This uses the same detached execution as _load() - on_load runs isolated
    // and result is applied via sequential queue
    const { data: result_data } = await this._execute_on_load_detached(false);  // false = don't use Load_Coordinator

    // Apply result via sequential queue
    // This handles normalization, caching, and setting _is_dynamic
    await this._apply_load_result(result_data, data_before_load);

    // Re-read data state after apply (for render decision below)
    const data_after_load = JSON.stringify(this.data);
    const data_changed = data_after_load !== data_before_load;

    // STEP 3: Conditionally re-render (with refresh() support)

    // Read force_refresh from state machine (default true)
    const force_refresh = this.next_reload_force_refresh !== null ? this.next_reload_force_refresh : true;

    // Track if we need to render
    let should_render = false;

    if (force_refresh) {
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
    if (should_render) {
      this._render();
    }

    // Reset state machine based on what we just executed
    if (force_refresh === false && this.next_reload_force_refresh === false) {
      this.next_reload_force_refresh = null;
    } else if (force_refresh === true && this.next_reload_force_refresh === true) {
      this.next_reload_force_refresh = null;
    }
    // If they don't match, another call was queued - leave it

    // STEP 3.5 & 4: Wait for children and call on_ready (only if we rendered)
    if (rendered_from_cache || should_render) {
      await this._wait_for_children_ready();
      await this._call_lifecycle('on_ready');
      this._fire_viewport_resize();
      // Trigger ready event so parent callbacks fire on subsequent reloads
      this.trigger('ready');
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

    // Early bailout: skip expensive cleanup if no handlers registered
    // Only matters for aborting boot() lifecycle - minimal cleanup sufficient
    const has_custom_stop = this.on_stop !== Jqhtml_Component.prototype.on_stop;
    const has_stop_callbacks = this._on_registered('stop');

    if (!has_custom_stop && !has_stop_callbacks) {
      // Fast path: no cleanup logic defined, just mark as stopped
      this._lifecycle_manager.unregister_component(this);
      this._ready_state = 99;
      return;
    }

    // Full cleanup path: component has custom stop logic
    this._log_lifecycle('destroy', 'start');
    this.$.addClass('_Component_Stopped');

    // Unregister from lifecycle manager
    this._lifecycle_manager.unregister_component(this);

    // Call user's on_stop() hook with authorization (sync)
    const stopResult = this._call_lifecycle_sync('on_stop');
    if (stopResult && typeof (stopResult as any).then === 'function') {
      console.warn(
        `[JQHTML] Component "${this.component_name()}" returned a Promise from on_stop(). ` +
        `on_stop() must be synchronous code. Remove 'async' from the function declaration.`
      );
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
  async on_ready(): Promise<void> {}
  on_stop(): void {}

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
    const currentDataState = JSON.stringify(this.data);
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
  component_name(): string {
    return this.constructor.name;
  }

  /**
   * Register event callback - delegates to component-events.ts
   * @see component-events.ts for full documentation
   */
  on(event_name: string, callback: (component: Jqhtml_Component, data?: any) => void): this {
    return event_on(this, event_name, callback);
  }

  /**
   * Register a callback that fires exactly once - delegates to component-events.ts
   * If the event already occurred, fires immediately and does not register.
   * @see component-events.ts for full documentation
   */
  once(event_name: string, callback: (component: Jqhtml_Component, data?: any) => void): this {
    return event_once(this, event_name, callback);
  }

  /**
   * Trigger a lifecycle event - delegates to component-events.ts
   * @see component-events.ts for full documentation
   */
  trigger(event_name: string, data?: any): void {
    event_trigger(this, event_name, data);
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
   * such as 'Parent_Dashboard' - is treated as the component-name class
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
   * Flatten instruction array - converts ['_content', [...]] markers to flat array
   * Recursively flattens nested content from content() calls
   */
  private _flatten_instructions(instructions: any[]): any[] {
    const result: any[] = [];

    for (const instruction of instructions) {
      // Check if this is a _content marker: ['_content', [...]]
      if (Array.isArray(instruction) && instruction[0] === '_content' && Array.isArray(instruction[1])) {
        // Recursively flatten the content instructions
        const contentInstructions = this._flatten_instructions(instruction[1]);
        result.push(...contentInstructions);
      } else {
        // Regular instruction - keep as is
        result.push(instruction);
      }
    }

    return result;
  }
  
  private _apply_css_classes(): void {
    const hierarchy = (this.constructor as typeof Jqhtml_Component).get_class_hierarchy();

    // If component name differs from class name, add component name to hierarchy
    // This happens when:
    // 1. Using base Jqhtml_Component with _component_name
    // 2. Using parent class via extends chain (e.g., Contacts_DataGrid using DataGrid_Abstract class)
    const classesToAdd = [...hierarchy];
    if (this.args._component_name && this.args._component_name !== this.constructor.name) {
      // Add component name at the beginning (most specific)
      classesToAdd.unshift(this.args._component_name);
    }

    // Filter out private classes (starting with _) and invalid class names
    const publicClasses = classesToAdd.filter(className => {
      // Guard against undefined, null, or non-string values
      if (!className || typeof className !== 'string') {
        console.warn('[JQHTML] Filtered out invalid class name:', className);
        return false;
      }
      return !className.startsWith('_');
    });

    if (publicClasses.length > 0) {
      this.$.addClass(publicClasses.join(' '));
    }
  }

  private _apply_default_attributes(): void {
    // Get template using same logic as render() method
    let template;

    // If we have a component name, try looking up by name first (for unregistered components)
    if (this.args._component_name) {
      template = get_template(this.args._component_name);
    } else {
      // Otherwise look up by class
      template = get_template_by_class(this.constructor as any);
    }

    if (!template) return;

    // Walk the extends chain to collect all defaultAttributes from parent templates
    // Apply from parent to child so child attributes take precedence
    const templateChain: any[] = [];
    let currentTemplate = template;

    // Build chain from child to parent
    while (currentTemplate) {
      templateChain.unshift(currentTemplate); // Add to front so parent comes first

      // Check if this template extends another
      if (currentTemplate.extends) {
        try {
          currentTemplate = get_template(currentTemplate.extends);
        } catch (error) {
          // Parent template not found, stop chain
          break;
        }
      } else {
        break;
      }
    }

    // Apply defaultAttributes from each template in the chain (parent first, child last)
    for (const tmpl of templateChain) {
      if (!tmpl.defaultAttributes) continue;

      // Filter out 'tag' since it determines tag name, not an attribute
      const defineAttrs = { ...tmpl.defaultAttributes };
      delete defineAttrs.tag;

      // Debug logging
      if ((window as any).jqhtml?.debug?.enabled) {
        const componentName = tmpl.name || this.args._component_name || this.constructor.name;
        console.log(`[Component] Applying defaultAttributes for ${componentName}:`, defineAttrs);
      }

      // Apply each default attribute
      for (const [key, value] of Object.entries(defineAttrs)) {
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
            // Parse existing styles (from invocation)
            const existingRules = new Map<string, string>();
            existingStyle.split(';').forEach(rule => {
              const [prop, val] = rule.split(':').map(s => s.trim());
              if (prop && val) existingRules.set(prop, val);
            });

            // Parse Define styles and only add if not already present
            String(value).split(';').forEach(rule => {
              const [prop, val] = rule.split(':').map(s => s.trim());
              if (prop && val && !existingRules.has(prop)) {
                // Only add if property doesn't exist (invocation wins)
                existingRules.set(prop, val);
              }
            });

            // Build merged style string
            const merged = Array.from(existingRules.entries())
              .map(([prop, val]) => `${prop}: ${val}`)
              .join('; ');
            this.$.attr('style', merged);
          } else {
            this.$.attr('style', value);
          }
        } else if (key.startsWith('$') || key.startsWith('data-')) {
          // Data attributes - also update args
          const dataKey = key.startsWith('$') ? key.substring(1) :
                         key.startsWith('data-') ? key.substring(5) : key;

          // Only apply if not already set in args
          if (!(dataKey in this.args)) {
            this.args[dataKey] = value;
            this.$.data(dataKey, value);
            this.$.attr(key.startsWith('$') ? `data-${dataKey}` : key, String(value));
          }
        } else {
          // Regular attributes - apply directly if not already set
          if (!this.$.attr(key)) {
            this.$.attr(key, value);
          }
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
    // Use new debug module
    logLifecycle(this, phase, status as 'start' | 'complete');
    
    // Keep legacy support for window.JQHTML_DEBUG
    if (typeof window !== 'undefined' && window.JQHTML_DEBUG) {
      window.JQHTML_DEBUG.log(this.component_name(), phase, status, {
        cid: this._cid,
        ready_state: this._ready_state,
        args: this.args
      });
    }
  }
  
  private _log_debug(action: string, ...args: any[]): void {
    if (typeof window !== 'undefined' && window.JQHTML_DEBUG) {
      window.JQHTML_DEBUG.log(
        this.component_name(),
        'debug',
        `${action}: ${args.map(a => JSON.stringify(a)).join(', ')}`
      );
    }
  }

}