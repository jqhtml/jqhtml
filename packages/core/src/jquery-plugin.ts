/**
 * JQHTML v2 jQuery Plugin
 * 
 * Extends jQuery with component method:
 * - $(el).component() - Get component instance
 * - $(el).component(ComponentClass, args) - Create component
 */

// Use global jQuery
declare const $: any;
import { Jqhtml_Component } from './component.js';
import type { ComponentConstructor } from './component-registry.js';
import {
  get_component_class,
  get_template
} from './component-registry.js';
import { applyDebugDelay, devWarn } from './debug.js';

// Extend jQuery interface
declare global {
  interface JQuery {
    /**
     * Get or create a component on this element
     */
    component(): Jqhtml_Component | null;
    component(ComponentClass: ComponentConstructor, args?: Record<string, any>): Jqhtml_Component;
    component(componentName: string, args?: Record<string, any>): Jqhtml_Component;

    /**
     * Find the nearest descendants matching the selector (opposite of closest)
     * Returns all descendants that match, but stops traversal at matches
     * (does not recurse into matched elements)
     *
     * Example: $element.shallowFind('.Widget') finds all .Widget descendants
     * but excludes any .Widget elements nested inside other .Widget elements
     */
    shallowFind(selector: string): JQuery;
  }
}

// Function to initialize jQuery plugin with the correct jQuery instance
export function init_jquery_plugin(jQuery: any): void {
  if (!jQuery || !jQuery.fn) {
    throw new Error('jQuery is required for JQHTML. Please ensure jQuery is loaded before initializing JQHTML.');
  }
  
  // Check if jQuery is from global scope (recommended)
  if (typeof window !== 'undefined' && (window as any).$ !== jQuery && !jQuery.__jqhtml_checked) {
    devWarn(
      'jQuery instance appears to be bundled with webpack/modules rather than loaded globally.\n' +
      'For best compatibility, it is recommended to:\n' +
      '1. Include jQuery via <script> tag from a CDN (UMD format)\n' +
      '2. Configure webpack with: externals: { jquery: "$" }\n' +
      '3. Remove jquery from package.json dependencies\n\n' +
      'To suppress this warning, set: window.JQHTML_SUPPRESS_WARNINGS = true'
    );
    // Mark this jQuery instance as checked to avoid duplicate warnings
    jQuery.__jqhtml_checked = true;
  }

  // Store original jQuery constructor
  const _jqhtml_original_jquery = jQuery;

  // Override jQuery constructor to handle component instances
  const JQueryWithComponentSupport: any = function(selector: any, context?: any) {
    // Check if selector is a JQHTML component instance
    if (
      selector &&
      typeof selector === 'object' &&
      selector.$ &&
      typeof selector.$sid === 'function' &&
      typeof selector.id === 'function'
    ) {
      // Return the component's jQuery element
      return selector.$;
    }

    // Otherwise, call original jQuery constructor
    return new _jqhtml_original_jquery(selector, context);
  };

  // Copy all jQuery static properties/methods to the new constructor
  Object.setPrototypeOf(JQueryWithComponentSupport, _jqhtml_original_jquery);
  for (const key in _jqhtml_original_jquery) {
    if (_jqhtml_original_jquery.hasOwnProperty(key)) {
      JQueryWithComponentSupport[key] = _jqhtml_original_jquery[key];
    }
  }

  // Copy prototype and fn
  JQueryWithComponentSupport.prototype = _jqhtml_original_jquery.prototype;
  JQueryWithComponentSupport.fn = _jqhtml_original_jquery.fn;

  // Replace global jQuery and $ (if in browser environment)
  if (typeof window !== 'undefined') {
    (window as any).jQuery = JQueryWithComponentSupport;
    (window as any).$ = JQueryWithComponentSupport;
  }

  // Update local reference for rest of this function
  jQuery = JQueryWithComponentSupport;

  // Store original jQuery.fn.val
  const originalVal = jQuery.fn.val;
  
  // Override jQuery.fn.val to support component delegation
  jQuery.fn.val = function(this: any, value?: any): any {
    if (arguments.length === 0) {
      // Getter mode - return value from first element
      const firstEl = this.first();
      if (firstEl.length === 0) return undefined;

      const component = firstEl.data('_component');
      const tagName = firstEl.prop('tagName');
      if (component && typeof component.val === 'function' && tagName !== 'INPUT' && tagName !== 'TEXTAREA') {
        // Delegate to component's val() method (but not if the component IS an input/textarea)
        return component.val();
      }

      // Fall back to original jQuery val()
      return originalVal.call(this);
    } else {
      // Setter mode - set value on all elements
      this.each(function(this: HTMLElement) {
        const $el = jQuery(this);
        const component = $el.data('_component');
        const tagName = $el.prop('tagName');

        if (component && typeof component.val === 'function' && tagName !== 'INPUT' && tagName !== 'TEXTAREA') {
          // Delegate to component's val() method (but not if the component IS an input/textarea)
          component.val(value);
        } else {
          // Fall back to original jQuery val()
          originalVal.call($el, value);
        }
      });

      // Return this for jQuery chaining
      return this;
    }
  };
  
  // Component instance method
  jQuery.fn.component = function(
    this: any,
    componentOrName?: ComponentConstructor | string,
    args: Record<string, any> = {}
  ): Jqhtml_Component | null {
    const element = this.first ? this.first() : this;

    if (!componentOrName) {
      // Getter mode - return existing component or null
      // Handle empty selector (no elements matched)
      if (element.length === 0) {
        return null;
      }

      const comp = element.data('_component');
      // Return null if no component found (instead of throwing)
      return comp || null;
    }

    // Check if component already exists on this element
    const existingComponent = element.data('_component');
    if (existingComponent) {
      // Stop existing component (with error handling to continue on failure)
      try {
        existingComponent.stop();
      } catch (error) {
        console.warn('[JQHTML] Error stopping existing component during replacement:', error);
      }

      // Remove component classes (any class starting with capital letter, except BEM classes)
      const classes = element.attr('class');
      if (classes) {
        const classList = classes.split(/\s+/);
        const nonComponentClasses = classList.filter((cls: string) => {
          // Keep class if:
          // 1. It's empty
          // 2. It doesn't start with a capital letter
          // 3. It's a BEM-style class (contains __) - these persist across reinitialization
          return !cls || cls[0] !== cls[0].toUpperCase() || cls[0] === cls[0].toLowerCase() || cls.includes('__');
        });
        element.attr('class', nonComponentClasses.join(' '));
      }

      // Remove component data
      element.removeData('_component');
    }

    // Setter mode - create new component
    let ComponentClass: ComponentConstructor;
    let componentName: string | undefined;

    if (typeof componentOrName === 'string') {
      // Look up by name (use default Component if not found)
      componentName = componentOrName;
      const found = get_component_class(componentOrName);

      // Always pass _component_name when instantiating by string name
      // This is critical for template resolution, especially when class is inherited via extends chain
      // Example: 'Contacts_DataGrid' uses DataGrid_Abstract class but needs Contacts_DataGrid template
      args = { ...args, _component_name: componentName };

      if (!found) {
        // Only warn if no template is defined either (truly undefined component)
        // The get_template() call will handle the warning appropriately
        // Use the base Jqhtml_Component class
        ComponentClass = Jqhtml_Component;
      } else {
        ComponentClass = found;
      }
    } else {
      // Direct class reference
      ComponentClass = componentOrName;
    }

    // Check if element tag matches expected tag from template
    let targetElement = element;
    if (componentName) {
      const template = get_template(componentName);
      // Tag precedence: _tag (invocation) > tag (template) > 'div'
      const expectedTag = args._tag || template.tag || 'div';
      const currentTag = element.prop('tagName').toLowerCase();

      if (currentTag !== expectedTag.toLowerCase()) {
        // Tag mismatch
        if (args._inner_html) {
          // Replace element with correct tag (only when using server-rendered content)
          const newElement = jQuery(`<${expectedTag}></${expectedTag}>`);

          // Copy all attributes from old element to new element
          const oldEl = element[0];
          if (oldEl && oldEl.attributes) {
            for (let i = 0; i < oldEl.attributes.length; i++) {
              const attr = oldEl.attributes[i];
              newElement.attr(attr.name, attr.value);
            }
          }

          // Copy innerHTML
          newElement.html(element.html());

          // Replace in DOM
          element.replaceWith(newElement);
          targetElement = newElement;
        } else if (currentTag !== 'body') {
          // Just warn - don't replace (suppress warning for <body> tags)
          console.warn(
            `[JQHTML] Component '${componentName}' expects tag '<${expectedTag}>' but element is '<${currentTag}>'. ` +
            `Element tag will not be changed. Consider using the correct tag.`
          );
        }
      }
    }

    // Create component instance - element first, then args
    const component = new ComponentClass(targetElement, args);

    // Boot the component (async, runs in background)
    (component as any)._boot();

    // Apply debug delay after component creation
    applyDebugDelay('component');

    // Return the jQuery element to enable chaining (fluent interface pattern)
    return targetElement;
  };

  /**
   * shallowFind - Find nearest descendants matching selector
   *
   * Opposite of closest(): searches downward instead of upward
   * Stops traversal when a match is found (does not recurse into matched elements)
   *
   * Example:
   *   <div id="root">
   *     <div class="Widget">        <!-- MATCHED -->
   *       <div class="Widget">      <!-- EXCLUDED (nested inside another .Widget) -->
   *       </div>
   *     </div>
   *     <div class="Widget">        <!-- MATCHED -->
   *     </div>
   *   </div>
   *
   *   $('#root').shallowFind('.Widget') returns 2 elements (excludes nested one)
   */
  jQuery.fn.shallowFind = function(this: any, selector: string): any {
    const results: HTMLElement[] = [];

    // Process each element in the jQuery collection
    this.each(function(this: HTMLElement) {
      // Recursive traversal function
      const traverse = (parent: HTMLElement) => {
        // Check direct children
        for (let i = 0; i < parent.children.length; i++) {
          const child = parent.children[i] as HTMLElement;

          // Check if this child matches the selector
          if (jQuery(child).is(selector)) {
            // Match found - add to results and DON'T recurse into it
            results.push(child);
          } else {
            // No match - recurse into this child
            traverse(child);
          }
        }
      };

      // Start traversal from this element
      traverse(this);
    });

    // Return jQuery collection of results
    return jQuery(results);
  };

  // Store original jQuery methods
  const originalEmpty = jQuery.fn.empty;
  const originalHtml = jQuery.fn.html;
  const originalText = jQuery.fn.text;

  // ---------------------------------------------------------------------------
  // Guard against hand-creating elements with data-sid via jQuery.
  //
  // $sid / data-sid is provisioned ONLY by the jqhtml template renderer, which
  // ALWAYS emits data-sid paired with a scoped id ("<sid>:<component_cid>").
  // That scoped id is what binds the element to its component; data-sid on its
  // own does nothing. So an element whose data-sid is NOT paired with such an id
  // was hand-written (e.g. .html('<div data-sid="x">')) and the framework never
  // provisioned it - this.$sid('x') can never find it. We detect exactly that.
  //
  // The framework's own rendering injects data-sid via native innerHTML, never
  // through these jQuery methods, and the one internal jQuery .html() copy
  // (the .component() tag-mismatch path) carries the provisioned id - so neither
  // trips this guard.
  // ---------------------------------------------------------------------------

  // Return the offending data-sid value if `html` contains a hand-written
  // data-sid element (data-sid without the scoped "<sid>:<cid>" id), else null.
  const find_manual_sid = (html: any): string | null => {
    if (typeof html !== 'string' || html.indexOf('data-sid') === -1) return null;
    if (typeof document === 'undefined') return null; // no DOM to parse (SSR)

    const tpl = document.createElement('template');
    tpl.innerHTML = html; // native parse - does not route back through jQuery
    const candidates = tpl.content.querySelectorAll('[data-sid]');
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      const sid = el.getAttribute('data-sid') || '';
      const id = el.getAttribute('id') || '';
      // Provisioned elements have id="<sid>:<cid>". Anything else is hand-written.
      if (id.indexOf(sid + ':') !== 0) return sid;
    }
    return null;
  };

  const assert_no_manual_sid = (value: any, where: string): void => {
    const sid = find_manual_sid(value);
    if (sid === null) return;
    throw new Error(
      `[JQHTML] Manually creating an element with data-sid="${sid}" via jQuery (${where}) is not allowed.\n\n` +
      `data-sid is NOT a normal attribute you can hand-write. It is provisioned by the jqhtml template\n` +
      `renderer, which scopes the element to its component by pairing data-sid with a unique id\n` +
      `("${sid}:<component_cid>"). An element you create yourself has no such scoped id, so\n` +
      `this.$sid('${sid}') / this.sid('${sid}') can never find it - scoping to a component is the entire\n` +
      `point of data-sid.\n\n` +
      `CORRECT USAGE:\n` +
      `  • Put the element in your component template with $sid:\n` +
      `      <div $sid="${sid}"></div>\n` +
      `    then access it from the component: this.$sid('${sid}')\n` +
      `  • Need it created dynamically? Use a child component or a $redrawable element in the template\n` +
      `    and render() it, instead of injecting raw HTML.\n\n` +
      `If you only need to select or mark a plain element, use a normal attribute or class instead:\n` +
      `  • <div data-role="${sid}"> → .find('[data-role="${sid}"]')\n` +
      `  • <div class="MyComponent__${sid}"> → .find('.MyComponent__${sid}')`
    );
  };

  /**
   * Override jQuery.fn.empty() to stop child components before clearing DOM
   * This ensures component cleanup hooks fire when DOM is cleared
   */
  jQuery.fn.empty = function(this: any): any {
    return this.each(function(this: HTMLElement) {
      // Stop all child components before clearing DOM
      jQuery(this).find('.Component').each(function(this: HTMLElement) {
        const component = jQuery(this).data('_component');
        if (component && !component._stopped) {
          component._stop(); // Stop just the component, DOM will be cleared anyway
        }
      });

      // Call original empty
      originalEmpty.call(jQuery(this));
    });
  };

  /**
   * Override jQuery.fn.html() to stop child components when setting new content
   * When used as setter, calls .empty() first to properly cleanup components
   */
  jQuery.fn.html = function(this: any, value?: any): any {
    // Getter - just pass through
    if (arguments.length === 0) {
      return originalHtml.call(this);
    }

    // Reject hand-written data-sid before mutating the DOM
    assert_no_manual_sid(value, '.html()');

    // Setter - empty first (which stops components), then set content
    return this.each(function(this: HTMLElement) {
      jQuery(this).empty();
      originalHtml.call(jQuery(this), value);
    });
  };

  /**
   * Override jQuery.fn.text() to stop child components when setting new content
   * When used as setter, calls .empty() first to properly cleanup components
   */
  jQuery.fn.text = function(this: any, value?: any): any {
    // Getter - just pass through
    if (arguments.length === 0) {
      return originalText.call(this);
    }

    // Setter - empty first (which stops components), then set content
    return this.each(function(this: HTMLElement) {
      jQuery(this).empty();
      originalText.call(jQuery(this), value);
    });
  };

  // Store original jQuery.fn.on
  const originalOn = jQuery.fn.on;

  // Common jQuery DOM events - no warning for these
  const COMMON_JQUERY_EVENTS = new Set([
    'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave',
    'keydown', 'keyup', 'keypress',
    'focus', 'blur', 'focusin', 'focusout',
    'change', 'input', 'submit', 'reset', 'select',
    'scroll', 'resize',
    'load', 'unload', 'error',
    'touchstart', 'touchend', 'touchmove', 'touchcancel',
    'contextmenu', 'wheel',
    'copy', 'cut', 'paste',
    'drag', 'dragstart', 'dragend', 'dragenter', 'dragleave', 'dragover', 'drop'
  ]);

  /**
   * Override jQuery.fn.on() to warn when attaching non-DOM events to component root elements
   *
   * JQHTML components have their own .on() method for lifecycle events (ready, create, render, etc).
   * Attaching these via jQuery .on() to a component's root element usually indicates
   * the developer meant to use component.on() instead.
   *
   * Common jQuery DOM events (click, change, focus, etc.) do not trigger a warning.
   */
  jQuery.fn.on = function(this: any, ...args: any[]): any {
    // Get event name (first argument)
    const eventName = typeof args[0] === 'string' ? args[0].split('.')[0] : null; // Strip namespace

    // Check for incorrect [data-sid usage in delegated selector (second argument)
    // Pattern: .on('click', '[data-sid="btn"]', handler)
    if (typeof args[1] === 'string' && args[1].includes('[data-sid')) {
      throw new Error(
        `[JQHTML] Incorrect use of data-sid in .on() delegated selector: "${args[1]}"\n\n` +
        `data-sid is a scoped ID system - the data-sid attribute exists only for debugging in DevTools ` +
        `and may be disabled in production.\n\n` +
        `CORRECT USAGE:\n` +
        `  • In templates: $sid="my_element"\n` +
        `  • In JavaScript: this.$sid('my_element').on('${args[0]}', handler)\n\n` +
        `$sid creates a unique ID scoped to the parent component, accessible only from within that component.\n\n` +
        `ALTERNATIVES for event delegation:\n` +
        `  • data-* attribute: <div data-role="btn"> → .on('${args[0]}', '[data-role="btn"]', handler)\n` +
        `  • BEM class name: <div class="MyComponent__btn"> → .on('${args[0]}', '.MyComponent__btn', handler)\n` +
        `  • Custom attribute: <div data-subelement="btn"> → .on('${args[0]}', '[data-subelement="btn"]', handler)`
      );
    }

    // Check first element for Component class and warn if needed
    if (eventName && !COMMON_JQUERY_EVENTS.has(eventName) && this.length > 0) {
      const firstEl = this.first();
      if (firstEl.hasClass('Component')) {
        const component = firstEl.data('_component');
        const componentName = component?.component_name?.() || 'Component';
        console.warn(
          `[JQHTML] jQuery .on('${args[0]}') called on <${componentName}> root element.\n` +
          `You may have meant to use component.on() for lifecycle events, or attach to a child element.`
        );
      }
    }

    // Call original .on() with all arguments
    return originalOn.apply(this, args);
  };

  // Store original jQuery.fn.find
  const originalFind = jQuery.fn.find;

  /**
   * Override jQuery.fn.find() to detect incorrect [data-sid usage
   *
   * data-sid is for DevTools debugging only and may be disabled in production.
   * Developers should use this.$sid('name') or this.sid('name') from within components.
   */
  jQuery.fn.find = function(this: any, selector: any): any {
    // Check for incorrect [data-sid usage
    if (typeof selector === 'string' && selector.includes('[data-sid')) {
      throw new Error(
        `[JQHTML] Incorrect use of data-sid in selector: "${selector}"\n\n` +
        `data-sid is a scoped ID system - the data-sid attribute exists only for debugging in DevTools ` +
        `and may be disabled in production.\n\n` +
        `CORRECT USAGE:\n` +
        `  • In templates: $sid="my_element"\n` +
        `  • In JavaScript: this.$sid('my_element') or this.sid('my_element')\n\n` +
        `$sid creates a unique ID scoped to the parent component, accessible only from within that component.\n\n` +
        `ALTERNATIVES for non-scoped element selection:\n` +
        `  • data-* attribute: <div data-role="input"> → .find('[data-role="input"]')\n` +
        `  • BEM class name: <div class="MyComponent__input"> → .find('.MyComponent__input')\n` +
        `  • Custom attribute: <div data-subelement="input"> → .find('[data-subelement="input"]')`
      );
    }

    // Pass through to original .find()
    return originalFind.call(this, selector);
  };

  // Guard the content-insertion methods that build elements from HTML strings,
  // plus $() construction. Wrapped once so repeated init() calls don't re-wrap.
  if (!jQuery.fn.__jqhtml_sid_guarded) {
    jQuery.fn.__jqhtml_sid_guarded = true;

    // .append('<div data-sid>'), .prepend, .before, .after, .replaceWith
    for (const name of ['append', 'prepend', 'before', 'after', 'replaceWith']) {
      const original = jQuery.fn[name];
      if (typeof original !== 'function') continue;
      jQuery.fn[name] = function(this: any, ...args: any[]): any {
        for (const arg of args) assert_no_manual_sid(arg, '.' + name + '()');
        return original.apply(this, args);
      };
    }

    // $('<div data-sid="x">') - catch the element at construction time. A
    // selector like $('[data-sid="x"]') parses to no data-sid element, so it is
    // not flagged here (selector misuse is handled by .find()/.on()).
    const originalInit = jQuery.fn.init;
    const PatchedInit: any = function(this: any, selector: any, context?: any, root?: any): any {
      if (typeof selector === 'string') assert_no_manual_sid(selector, '$()');
      return new originalInit(selector, context, root);
    };
    PatchedInit.prototype = jQuery.fn;
    jQuery.fn.init = PatchedInit;
  }
}

// Try to auto-initialize if global jQuery exists
if (typeof window !== 'undefined' && (window as any).jQuery) {
  init_jquery_plugin((window as any).jQuery);
}