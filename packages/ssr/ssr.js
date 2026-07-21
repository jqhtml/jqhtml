/**
 * JQHTML Server-Side Rendering - Proof of Concept
 *
 * Sets up a jsdom environment with jQuery, loads compiled bundles,
 * and renders JQHTML components to HTML strings.
 *
 * This version uses vm.runInThisContext to avoid VM context boundary issues
 * with jQuery function references.
 *
 * IMPORTANT: jQuery must be required BEFORE global.window is set,
 * otherwise jQuery auto-initializes and returns an object instead of factory.
 */

const { JSDOM } = require('jsdom');
const vm = require('vm');
const fs = require('fs');
const path = require('path');

// CRITICAL: Require jQuery BEFORE any global.window is set
// This ensures jQuery returns a factory function, not an auto-bound object
const jqueryFactory = require('jquery');

class SSREnvironment {
  constructor() {
    this.dom = null;
    this.window = null;
    this.$ = null;
    this.initialized = false;
  }

  /**
   * Initialize the jsdom environment with jQuery
   */
  init() {
    // Create a jsdom instance with a basic HTML document
    this.dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>SSR</title></head>
        <body></body>
      </html>
    `, {
      url: 'http://localhost',
      pretendToBeVisual: true,
      runScripts: 'outside-only'
    });

    this.window = this.dom.window;

    // Set up global references that the bundles expect
    // Since we're using runInThisContext, bundles access Node's global directly
    global.window = this.window;
    global.document = this.window.document;
    global.HTMLElement = this.window.HTMLElement;
    global.Element = this.window.Element;
    global.Node = this.window.Node;
    global.NodeList = this.window.NodeList;
    global.DOMParser = this.window.DOMParser;
    global.Text = this.window.Text;
    global.DocumentFragment = this.window.DocumentFragment;
    global.Event = this.window.Event;
    global.CustomEvent = this.window.CustomEvent;
    global.MutationObserver = this.window.MutationObserver;

    // Navigator might be read-only, try to set it safely
    try {
      Object.defineProperty(global, 'navigator', {
        value: this.window.navigator,
        writable: true,
        configurable: true
      });
    } catch (e) {
      // If we can't set navigator globally, that's okay - window.navigator exists
    }

    // Window-like globals
    global.self = this.window;
    global.top = this.window;
    global.parent = this.window;
    global.frames = this.window;
    global.location = this.window.location;
    global.history = this.window.history;
    global.screen = this.window.screen;
    global.localStorage = this.window.localStorage;
    global.sessionStorage = this.window.sessionStorage;
    global.performance = this.window.performance;
    global.requestAnimationFrame = this.window.requestAnimationFrame;
    global.cancelAnimationFrame = this.window.cancelAnimationFrame;
    global.getComputedStyle = this.window.getComputedStyle;
    global.atob = this.window.atob;
    global.btoa = this.window.btoa;

    // Mark as SSR environment
    this.window.__SSR__ = true;
    global.__SSR__ = true;

    // Create jQuery bound to our jsdom window
    // jqueryFactory was required at module load time (before global.window existed)
    this.$ = jqueryFactory(this.window);

    // Make jQuery available globally (bundles expect this)
    // Important: Both global.$ and global.window.$ must point to the same bound jQuery
    global.$ = this.$;
    global.jQuery = this.$;
    this.window.$ = this.$;
    this.window.jQuery = this.$;

    console.log('[SSR] jQuery.fn available:', !!this.$.fn);

    // Set up rsxapp config object that bundles expect
    this.window.rsxapp = this.window.rsxapp || {};
    global.rsxapp = this.window.rsxapp;

    // Stub console_debug if bundles use it
    this.window.console_debug = function() {};
    global.console_debug = function() {};

    this.initialized = true;
    console.log('[SSR] Environment initialized');
    console.log('[SSR] jQuery available:', !!this.$);
    console.log('[SSR] jQuery is function:', typeof this.$);
    console.log('[SSR] jQuery.fn.jquery (version):', this.$.fn && this.$.fn.jquery);
  }

  /**
   * Load a JavaScript bundle file and execute it in our environment
   */
  loadBundle(bundlePath) {
    if (!this.initialized) {
      throw new Error('SSR environment not initialized. Call init() first.');
    }

    const absolutePath = path.resolve(bundlePath);
    console.log(`[SSR] Loading bundle: ${absolutePath}`);

    const code = fs.readFileSync(absolutePath, 'utf8');

    // Remove sourcemap comments to avoid errors
    const cleanCode = code.replace(/\/\/# sourceMappingURL=.*/g, '');

    try {
      // Debug: check globals before running bundle
      console.log('[SSR DEBUG] Before bundle:');
      console.log('[SSR DEBUG] typeof global.$:', typeof global.$);
      console.log('[SSR DEBUG] typeof global.jQuery:', typeof global.jQuery);
      console.log('[SSR DEBUG] typeof global.window:', typeof global.window);
      console.log('[SSR DEBUG] global.$ === global.window.$:', global.$ === global.window.$);

      // Execute the bundle in Node's global context
      // This avoids VM context boundary issues with function references
      vm.runInThisContext(cleanCode, {
        filename: absolutePath,
        displayErrors: true
      });

      console.log(`[SSR] Bundle loaded successfully`);

      // Debug: check if jqhtml is now available
      if (global.window.jqhtml) {
        console.log('[SSR] jqhtml available after bundle load');
      }
    } catch (err) {
      console.error(`[SSR] Error loading bundle:`, err.message);
      console.error(err.stack);
      throw err;
    }
  }

  /**
   * Load multiple bundle files in order
   */
  loadBundles(bundlePaths) {
    for (const bundlePath of bundlePaths) {
      this.loadBundle(bundlePath);
    }
  }

  /**
   * Render a component to HTML string
   *
   * @param {string} componentName - The name of the component to render
   * @param {object} args - Arguments to pass to the component
   * @returns {Promise<string>} - The rendered HTML
   */
  async render(componentName, args = {}) {
    if (!this.initialized) {
      throw new Error('SSR environment not initialized. Call init() first.');
    }

    console.log(`[SSR] Rendering component: ${componentName}`);

    // Use the global jQuery (which is now the jqhtml-enhanced version)
    const $ = global.$;

    // Create a container element
    const $container = $('<div>');

    // Create the component using jQuery plugin syntax
    // This is how jqhtml components are instantiated
    $container.component(componentName, args);

    // Get the component instance
    const component = $container.component();

    if (!component) {
      throw new Error(`Failed to create component: ${componentName}`);
    }

    // Wait for the component to be ready (lifecycle complete)
    try {
      await component.ready();
      console.log(`[SSR] Component ${componentName} is ready`);
    } catch (err) {
      console.error(`[SSR] Error waiting for component ready:`, err);
      throw err;
    }

    // Return the rendered HTML
    const html = component.$.prop('outerHTML');
    console.log(`[SSR] Rendered ${html.length} bytes of HTML`);

    return html;
  }

  /**
   * Get information about registered templates
   */
  getRegisteredTemplates() {
    if (global.window.jqhtml && global.window.jqhtml._templates) {
      return Array.from(global.window.jqhtml._templates.keys());
    }
    return [];
  }

  /**
   * Check if jqhtml runtime is available
   */
  isJqhtmlReady() {
    return !!(global.window.jqhtml);
  }
}

module.exports = { SSREnvironment };
