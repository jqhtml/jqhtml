/**
 * JQHTML v2 Core Runtime
 * 
 * Main entry point for the JQHTML runtime library
 */

// Core exports
export { Jqhtml_Component } from './component.js';
export { LifecycleManager } from './lifecycle-manager.js';
export type { LifecyclePhase } from './lifecycle-manager.js';

// Registry exports
export {
  register,
  register_component,
  register_template,
  get_component_class,
  get_template,
  get_template_by_class,
  create_component,
  has_component,
  get_component_names,
  get_registered_templates,
  list_components
} from './component-registry.js';
export type { ComponentConstructor, TemplateFunction, TemplateDefinition } from './component-registry.js';

// Instruction processing
export {
  process_instructions,
  extract_slots
} from './instruction-processor.js';
export type {
  Instruction,
  TagInstruction,
  ComponentInstruction,
  SlotInstruction
} from './instruction-processor.js';

// Template support
export {
  render_template,
  escape_html,
  escape_html_nl2br
} from './template-renderer.js';

// Boot (server-side component hydration)
export { boot } from './boot.js';

// Debug support
export {
  logLifecycle,
  applyDebugDelay,
  logDispatch,
  logInstruction,
  logDataChange,
  isSequentialProcessing,
  handleComponentError,
  devWarn
} from './debug.js';

// Template compilation is handled at build time by @jqhtml/parser
// Use build tools (Vite plugin, etc.) to compile .jqhtml files

// jQuery plugin initialization
import { init_jquery_plugin } from './jquery-plugin.js';
export { init_jquery_plugin };

// Main initialization function
export function init(jQuery?: any): void {
  // If jQuery is provided, initialize the plugin
  if (jQuery) {
    init_jquery_plugin(jQuery);
  } else if (typeof window !== 'undefined' && (window as any).jQuery) {
    // Try to use global jQuery
    init_jquery_plugin((window as any).jQuery);
  } else {
    throw new Error('jQuery is required for JQHTML. Please pass jQuery to init() or ensure it is available globally.');
  }
}


// No backwards compatibility - Jqhtml_Component only
export { LifecycleManager as Jqhtml_LifecycleManager } from './lifecycle-manager.js';

// Import all for default export
import { Jqhtml_Component } from './component.js';
import { LifecycleManager } from './lifecycle-manager.js';
import {
  register,
  register_component,
  register_template,
  get_component_class,
  get_template,
  get_template_by_class,
  create_component,
  has_component,
  get_component_names,
  get_registered_templates,
  list_components
} from './component-registry.js';
import {
  process_instructions,
  extract_slots
} from './instruction-processor.js';
import {
  render_template,
  escape_html,
  escape_html_nl2br
} from './template-renderer.js';
import { boot } from './boot.js';
// Template compilation removed - handled at build time by @jqhtml/parser

// jQuery plugin (side effect import - adds .component() method)
import './jquery-plugin.js';

// Local storage (internal only - not exported in public API, but exported for internal use)
import { Jqhtml_Local_Storage, register_cache_class } from './local-storage.js';
export { Jqhtml_Local_Storage, register_cache_class };
export type { CacheMode } from './local-storage.js';

// Load coordinator (internal only - not exported in public API, but exported for internal use)
import { Load_Coordinator } from './load-coordinator.js';
export { Load_Coordinator };

// SSR Preload data system
import {
  start_data_capture,
  get_captured_data,
  stop_data_capture,
  set_preload_data,
  clear_preload_data
} from './preload-data.js';
export { start_data_capture, get_captured_data, stop_data_capture, set_preload_data, clear_preload_data };
export type { PreloadEntry } from './preload-data.js';

// Version - will be replaced during build with actual version from package.json
export const version = '__VERSION__';

// Debug settings interface
export interface DebugSettings {
  // Logging options
  verbose?: boolean;               // Enable verbose internal logging (lifecycle manager, registry lookups)
  logCreationReady?: boolean;      // Log only create/ready events
  logFullLifecycle?: boolean;      // Log all lifecycle events (overrides logCreationReady)
  logDispatch?: boolean;           // Basic dispatch logging (default true in dev)
  logDispatchVerbose?: boolean;    // Extended dispatch debug info
  
  // Timing options
  delayAfterComponent?: number;    // ms delay after $().component() call
  delayAfterRender?: number;       // ms delay after initial render
  delayAfterRerender?: number;     // ms delay after re-render (if applicable)
  sequentialProcessing?: boolean;  // Process components one at a time instead of parallel siblings
  
  // Visual feedback
  flashComponents?: boolean;       // Flash border on lifecycle events
  flashDuration?: number;          // Duration of flash animation (default 500ms)
  flashColors?: {
    create?: string;             // Color for creation (default: blue)
    render?: string;             // Color for render (default: green)
    ready?: string;              // Color for ready (default: purple)
  };
  
  // Advanced debugging
  showComponentTree?: boolean;     // Show real-time component tree
  profilePerformance?: boolean;    // Track render times and lifecycle durations
  breakOnError?: boolean;          // Pause execution on component errors
  traceDataFlow?: boolean;         // Log all data changes and prop passing
  logInstructionProcessing?: boolean; // Log instruction array processing
  highlightSlowRenders?: number;   // Highlight components taking > N ms to render
}

// Default export with all functionality
const jqhtml = {
  // Core
  Jqhtml_Component,
  LifecycleManager,

  // Registry
  register,
  register_component,
  register_template,
  get_component_class,
  get_template,
  get_template_by_class,
  create_component,
  has_component,
  get_component_names,
  get_registered_templates,
  list_components,
  
  // Template system
  process_instructions,
  extract_slots,
  render_template,
  escape_html,
  escape_html_nl2br,
  
  // Version property - internal
  __version: version,

  // state facts
  tombstone: 'pepperoni and cheese',

  // Debug settings
  debug: {
    enabled: false,
    verbose: false
  } as DebugSettings & { enabled: boolean; verbose: boolean },
  
  // Debug helper functions (mainly for internal use but exposed for advanced debugging)
  setDebugSettings(settings: DebugSettings) {
    Object.assign(this.debug, settings);
  },
  
  enableDebugMode(level: 'basic' | 'full' = 'basic') {
    if (level === 'basic') {
      this.debug.logCreationReady = true;
      this.debug.logDispatch = true;
      this.debug.flashComponents = true;
    } else {
      this.debug.logFullLifecycle = true;
      this.debug.logDispatchVerbose = true;
      this.debug.flashComponents = true;
      this.debug.profilePerformance = true;
      this.debug.traceDataFlow = true;
    }
  },
  
  clearDebugSettings() {
    this.debug = {};
  },

  // Install globals function
  installGlobals() {
    if (typeof window !== 'undefined') {
      (window as any).jqhtml = this;
      // Also install class references
      (window as any).Jqhtml_Component = Jqhtml_Component;
      (window as any).Jqhtml_LifecycleManager = LifecycleManager;
    }
  },

  // Version display function - shows version of core library and all registered templates
  _version() {
    console.log(`JQHTML Core v${this.__version}`);
    console.log('Registered Templates:');

    const templateNames = get_component_names();

    if (templateNames.length === 0) {
      console.log('  (no templates registered)');
    } else {
      for (const name of templateNames) {
        const template = get_template(name);
        const templateVersion = template ? ((template as any)._jqhtml_version || 'unknown') : 'unknown';
        console.log(`  - ${name}: v${templateVersion}`);
      }
    }

    return this.__version;
  },

  // Public version function - returns the stamped version number
  version() {
    return version;
  },

  // Cache key setter - enables component caching via local storage
  // cache_mode: 'data' (default, recommended) or 'html'
  set_cache_key(cache_key: string, cache_mode: 'data' | 'html' = 'data') {
    Jqhtml_Local_Storage.set_cache_key(cache_key, cache_mode);
  },

  // Get current cache mode
  get_cache_mode() {
    return Jqhtml_Local_Storage.get_cache_mode();
  },

  // Register a class for cache serialization/deserialization
  // Required for ES6 class instances to be stored and restored from localStorage
  register_cache_class,

  // Boot - hydrate server-rendered component placeholders
  boot,

  // SSR Preload - capture data during SSR, replay on client to skip on_load()
  start_data_capture,
  get_captured_data,
  stop_data_capture,
  set_preload_data,
  clear_preload_data
};

// Auto-register on window for browser environments
// This is REQUIRED for compiled templates which use window.jqhtml.register_template()
// Templates generated by @jqhtml/webpack-loader and other build tools expect this global
// This ensures compatibility whether jqhtml is imported as ES module or loaded via script tag
if (typeof window !== 'undefined' && !(window as any).jqhtml) {
  (window as any).jqhtml = jqhtml;
  // Also register the component classes for convenience
  (window as any).Jqhtml_Component = Jqhtml_Component;
  (window as any).Component = Jqhtml_Component; // For backwards compatibility
  (window as any).Jqhtml_LifecycleManager = LifecycleManager;

  // Inject animation-disable style into document head
  // Used to prevent animations during re-render after on_load() data changes
  const style = document.createElement('style');
  style.id = '__jqhtml_styles';
  style.textContent = `
.__jqhtml_disable_animations *,
.__jqhtml_disable_animations *::before,
.__jqhtml_disable_animations *::after {
  animation: none !important;
  transition: none !important;
}`;
  document.head.appendChild(style);

  // Log in debug mode
  if (jqhtml.debug?.enabled) {
    console.log('[JQHTML] Auto-registered window.jqhtml global for template compatibility');
  }
}

export default jqhtml;