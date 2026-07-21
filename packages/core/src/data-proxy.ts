/**
 * JQHTML Data Proxy System
 *
 * Extracted from component.ts - handles:
 * - Data freeze/unfreeze enforcement via Proxy
 * - Detached on_load() execution with restricted access
 */

import { Load_Coordinator } from './load-coordinator.js';

/**
 * Set up the `this.data` property on a component using Object.defineProperty
 * with a Proxy that enforces freeze/unfreeze semantics.
 *
 * After setup:
 * - `this.data` reads/writes go through a Proxy
 * - When `component.__data_frozen === true`, writes throw errors
 * - When frozen is false, writes pass through normally
 *
 * @param component - The component instance to set up data on
 */
export function setup_data_property(component: any): void {
  let _data: Record<string, any> = {};

  // Helper to create frozen proxy for data object
  const create_proxy = (obj: Record<string, any>): Record<string, any> => {
    return new Proxy(obj, {
      set: (target, prop, value) => {
        if (component.__data_frozen) {
          console.error(
            `[JQHTML] ERROR: Component "${component.component_name()}" attempted to modify this.data.${String(prop)} outside of on_create() or on_load().\n\n` +
            `RESTRICTION: this.data can ONLY be modified in:\n` +
            `  - on_create() (set initial defaults, synchronous only)\n` +
            `  - on_load() (fetch data from APIs, can be async)\n\n` +
            `WHY: this.data represents loaded state. Modifying it outside these methods bypasses the framework's render cycle.\n\n` +
            `FIX: Modify this.data in on_create() (for defaults) or on_load() (for fetched data):\n` +
            `  ❌ In on_ready(): this.data.${String(prop)} = ${JSON.stringify(value)};\n` +
            `  ✅ In on_create(): this.data.${String(prop)} = ${JSON.stringify(value)}; // Set default\n` +
            `  ✅ In on_load(): this.data.${String(prop)} = ${JSON.stringify(value)}; // Fetch from API\n` +
            `  ✅ For component state: this.args.${String(prop)} = ${JSON.stringify(value)}; (accessible in on_load)`
          );

          throw new Error(
            `[JQHTML] Cannot modify this.data.${String(prop)} outside of on_create() or on_load(). ` +
            `this.data is frozen after on_create() and unfrozen only during on_load().`
          );
        }
        target[prop as keyof typeof target] = value;
        return true;
      },
      deleteProperty: (target, prop) => {
        if (component.__data_frozen) {
          console.error(
            `[JQHTML] ERROR: Component "${component.component_name()}" attempted to delete this.data.${String(prop)} outside of on_create() or on_load().\n\n` +
            `RESTRICTION: this.data can ONLY be modified in:\n` +
            `  - on_create() (set initial defaults, synchronous only)\n` +
            `  - on_load() (fetch data from APIs, can be async)\n\n` +
            `WHY: this.data represents loaded state. Modifying it outside these methods bypasses the framework's render cycle.`
          );

          throw new Error(
            `[JQHTML] Cannot delete this.data.${String(prop)} outside of on_create() or on_load(). ` +
            `this.data is frozen after on_create() and unfrozen only during on_load().`
          );
        }
        delete target[prop as keyof typeof target];
        return true;
      }
    });
  };

  // Create initial proxied data object
  _data = create_proxy({});

  Object.defineProperty(component, 'data', {
    get: () => _data,
    set: (value: Record<string, any>) => {
      if (component.__data_frozen) {
        console.error(
          `[JQHTML] ERROR: Component "${component.component_name()}" attempted to reassign this.data outside of on_create() or on_load().\n\n` +
          `RESTRICTION: this.data can ONLY be modified in:\n` +
          `  - on_create() (set initial defaults, synchronous only)\n` +
          `  - on_load() (fetch data from APIs, can be async)\n\n` +
          `WHY: this.data represents loaded state. Modifying it outside these methods bypasses the framework's render cycle.\n\n` +
          `FIX: Modify this.data in on_create() (for defaults) or on_load() (for fetched data):\n` +
          `  ❌ In on_ready(): this.data = {...};\n` +
          `  ✅ In on_create(): this.data.count = 0; // Set default\n` +
          `  ✅ In on_load(): this.data = await fetch(...); // Fetch from API\n` +
          `  ✅ For component state: this.args.count = 5; (accessible in on_load)`
        );

        throw new Error(
          `[JQHTML] Cannot reassign this.data outside of on_create() or on_load(). ` +
          `this.data is frozen after on_create() and unfrozen only during on_load().`
        );
      }
      // When setting, wrap the new value in a proxy too
      _data = create_proxy(value);
    },
    enumerable: true,
    configurable: false
  });
}

/**
 * Execute on_load() in a detached context with restricted access.
 *
 * Creates a sandboxed environment where on_load() can only access:
 * - this.args (read-only)
 * - this.data (read/write, cloned from __initial_data_snapshot)
 *
 * All other property access (this.$, this.$sid, etc.) throws errors.
 *
 * @param component - The component instance
 * @param use_load_coordinator - Whether to use Load_Coordinator for deduplication
 * @returns The resulting data and optional coordination completion function
 */
export async function execute_on_load_detached(component: any, use_load_coordinator: boolean = false): Promise<{
  data: Record<string, any>;
  complete_coordination: ((data: Record<string, any>) => void) | null;
}> {
  // Clone this.data from the snapshot captured after on_create()
  const data_clone = component.__initial_data_snapshot
    ? JSON.parse(JSON.stringify(component.__initial_data_snapshot))
    : {};

  // Create a read-only proxy for args that blocks all modifications
  // Can't use JSON clone because args may contain functions (_slots, callbacks)
  const component_name = component.component_name();

  const create_readonly_proxy = (obj: any, path: string = 'this.args'): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    return new Proxy(obj, {
      get(target: any, prop: string | symbol) {
        const value = target[prop];
        // Recursively wrap nested objects (but not functions)
        if (value !== null && typeof value === 'object' && typeof value !== 'function') {
          return create_readonly_proxy(value, `${path}.${String(prop)}`);
        }
        return value;
      },
      set(_target: any, prop: string | symbol, value: any) {
        console.error(
          `[JQHTML] ERROR: Component "${component_name}" attempted to modify ${path}.${String(prop)} during on_load().\n\n` +
          `RESTRICTION: this.args is READ-ONLY during on_load().\n\n` +
          `WHY: this.args configures what data to fetch. Modifying it during on_load() creates circular dependencies.\n\n` +
          `FIX: Modify this.args BEFORE on_load() runs (in on_create() or before calling reload()):\n` +
          `  ❌ Inside on_load(): ${path}.${String(prop)} = ${JSON.stringify(value)};\n` +
          `  ✅ In on_create(): this.args.${String(prop)} = defaultValue;`
        );
        throw new Error(
          `[JQHTML] Cannot modify ${path}.${String(prop)} during on_load(). ` +
          `this.args is read-only in on_load().`
        );
      },
      deleteProperty(_target: any, prop: string | symbol) {
        console.error(
          `[JQHTML] ERROR: Component "${component_name}" attempted to delete ${path}.${String(prop)} during on_load().\n\n` +
          `RESTRICTION: this.args is READ-ONLY during on_load().`
        );
        throw new Error(
          `[JQHTML] Cannot delete ${path}.${String(prop)} during on_load(). ` +
          `this.args is read-only in on_load().`
        );
      }
    });
  };

  // Create a detached context object that on_load will operate on
  const detached_context: any = {
    args: create_readonly_proxy(component.args),  // Read-only proxy wrapping real args
    data: data_clone  // Cloned data - modifications stay isolated
  };

  // Create restricted proxy that operates on the detached context
  const restricted_this = new Proxy(detached_context, {
    get(target: any, prop: string | symbol) {
      // Only allow access to args and data
      if (prop === 'args') {
        return target.args;
      }
      if (prop === 'data') {
        return target.data;
      }

      // Block everything else
      console.error(
        `[JQHTML] ERROR: Component "${component_name}" attempted to access this.${String(prop)} during on_load().\n\n` +
        `RESTRICTION: on_load() may ONLY access:\n` +
        `  - this.args (read-only)\n` +
        `  - this.data (read/write)\n\n` +
        `WHY: on_load() is for data fetching only. All other component functionality should happen in other lifecycle methods.\n\n` +
        `FIX:\n` +
        `  - DOM manipulation → use on_render() or on_ready()\n` +
        `  - Component methods → call them before/after on_load(), not inside it\n` +
        `  - Other properties → restructure code to only use this.args and this.data in on_load()`
      );

      throw new Error(
        `[JQHTML] Cannot access this.${String(prop)} during on_load(). ` +
        `on_load() may only access this.args and this.data.`
      );
    },
    set(target: any, prop: string | symbol, value: any) {
      // Only allow setting data
      if (prop === 'data') {
        target.data = value;
        return true;
      }

      // Block setting args
      if (prop === 'args') {
        console.error(
          `[JQHTML] ERROR: Component "${component_name}" attempted to modify this.args during on_load().\n\n` +
          `RESTRICTION: on_load() may ONLY modify:\n` +
          `  - this.data (read/write)\n\n` +
          `WHY: this.args is component state that on_load() depends on. Modifying it inside on_load() creates circular dependencies.\n\n` +
          `FIX: Modify this.args BEFORE calling on_load() (in on_create() or other lifecycle methods), not inside on_load():\n` +
          `  ❌ Inside on_load(): this.args.filter = 'new_value';\n` +
          `  ✅ In on_create(): this.args.filter = this.args.initial_filter || 'default';`
        );

        throw new Error(
          `[JQHTML] Cannot modify this.args during on_load(). ` +
          `Modify this.args in other lifecycle methods, not inside on_load().`
        );
      }

      // Block setting any other properties
      console.error(
        `[JQHTML] ERROR: Component "${component_name}" attempted to modify this.${String(prop)} during on_load().\n\n` +
        `RESTRICTION: on_load() may ONLY modify:\n` +
        `  - this.data (read/write)\n\n` +
        `WHY: on_load() is for data fetching only. Setting properties on the component instance should happen in other lifecycle methods.\n\n` +
        `FIX: Store your data in this.data instead:\n` +
        `  ❌ this.${String(prop)} = value;\n` +
        `  ✅ this.data.${String(prop)} = value;`
      );

      throw new Error(
        `[JQHTML] Cannot modify this.${String(prop)} during on_load(). ` +
        `Only this.data can be modified in on_load().`
      );
    }
  });

  // Create promise for this on_load() call
  const on_load_promise = (async () => {
    try {
      await component._call_lifecycle('on_load', restricted_this);
    } catch (error: any) {
      if (use_load_coordinator) {
        // Handle error and notify coordinator
        Load_Coordinator.handle_leader_error(component, error as Error);
      }
      throw error;
    }
  })();

  // If using Load_Coordinator, register as leader
  // Note: We store the completion function but DON'T call it here
  // It will be called by _load() after _apply_load_result() updates this.data
  let complete_coordination: ((data: Record<string, any>) => void) | null = null;
  if (use_load_coordinator) {
    complete_coordination = Load_Coordinator.register_leader(component, on_load_promise);
  }

  await on_load_promise;

  // Note: We don't validate args changes here because external code (like parent
  // components calling reload()) is allowed to modify component.args during on_load().
  // The read-only proxy only prevents code INSIDE on_load() from modifying args.

  // Return the data from the detached context AND the completion function
  return {
    data: detached_context.data,
    complete_coordination
  };
}
