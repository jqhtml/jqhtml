/**
 * JQHTML Data Proxy System
 *
 * Extracted from component.ts - handles:
 * - Data freeze/unfreeze enforcement via Proxy
 * - Detached on_load() execution with restricted access
 */

import { Load_Coordinator } from './load-coordinator.js';

/**
 * JSON for an error message. The value being rejected is arbitrary author data and may
 * be cyclic or otherwise unserializable - the diagnostic must never throw over the
 * error it is trying to report.
 */
function safe_json(value: any): string {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? String(value) : text;
  } catch {
    return String(value);
  }
}

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

  // Wrapper memo for the deep-freeze proxies. Keyed by the RAW target object, so a
  // value read twice returns the same wrapper and `this.data.items === this.data.items`
  // holds - identity comparisons and `Set`/`Map` membership on nested data keep working.
  // WeakMap: a wrapper dies with the object it wraps.
  const frozen_wrappers = new WeakMap<object, any>();

  // Only plain objects and arrays are wrapped. Anything with a real prototype
  // (Date, Map, Set, and classes restored by register_cache_class()) carries internal
  // slots that a Proxy receiver cannot satisfy: `this.data.created.getTime()` would
  // call the method with the proxy as `this` and throw. Those values pass through raw -
  // a shallow hole we accept, because breaking Date/Map/Set reads would be worse than
  // missing a rare mutation of one.
  const is_wrappable = (value: any): boolean => {
    if (value === null || typeof value !== 'object') return false;
    if (Array.isArray(value)) return true;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  };

  // Dotted path for error messages: array indices read as [0], keys as .name
  const join_path = (path: string, target: any, prop: string | symbol): string =>
    Array.isArray(target) ? `${path}[${String(prop)}]` : `${path}.${String(prop)}`;

  const frozen_violation = (path: string, verb: 'modify' | 'delete', value?: any): never => {
    const value_text = verb === 'modify' ? ` = ${safe_json(value)}` : '';
    console.error(
      `[JQHTML] ERROR: Component "${component.component_name()}" attempted to ${verb} ${path} outside of on_create() or on_load().\n\n` +
      `RESTRICTION: this.data can ONLY be modified in:\n` +
      `  - on_create() (set initial defaults, synchronous only)\n` +
      `  - on_load() (fetch data from APIs, can be async)\n\n` +
      `NESTED VALUES COUNT: the freeze is DEEP. Mutating an object or array inside\n` +
      `this.data (push, splice, assigning a property, delete) is modifying this.data.\n\n` +
      `WHY: this.data represents loaded state. Modifying it outside these methods bypasses the framework's render cycle.\n\n` +
      `FIX:\n` +
      `  ❌ In on_ready(): ${path}${value_text};\n` +
      `  ✅ In on_load(): fetch the value, so the framework can re-render\n` +
      `  ✅ For component-local bookkeeping: this.state (unrestricted, never cached)`
    );

    throw new Error(
      `[JQHTML] Cannot ${verb} ${path} outside of on_create() or on_load(). ` +
      `this.data is frozen after on_create() and unfrozen only during on_load(). ` +
      `The freeze is deep - nested objects and arrays are frozen too.`
    );
  };

  // Read-only view of a nested value. Handed out ONLY while __data_frozen is true
  // (the top-level get trap checks), so the traps here never need to re-check: a
  // wrapper the author kept a reference to stays read-only for its whole life.
  const create_frozen_wrapper = (obj: any, path: string): any => {
    const existing = frozen_wrappers.get(obj);
    if (existing) return existing;

    const wrapper = new Proxy(obj, {
      get: (target, prop) => {
        const value = (target as any)[prop];
        // Functions are returned raw: array methods are invoked with the wrapper as
        // `this`, so push/splice still land in this trap's set/deleteProperty.
        return is_wrappable(value) ? create_frozen_wrapper(value, join_path(path, target, prop)) : value;
      },
      set: (target, prop, value) => frozen_violation(join_path(path, target, prop), 'modify', value),
      deleteProperty: (target, prop) => frozen_violation(join_path(path, target, prop), 'delete')
    });

    frozen_wrappers.set(obj, wrapper);
    return wrapper;
  };

  // Helper to create frozen proxy for data object
  const create_proxy = (obj: Record<string, any>): Record<string, any> => {
    return new Proxy(obj, {
      get: (target, prop) => {
        const value = target[prop as keyof typeof target];
        // Deep freeze: while frozen, every nested object/array is read through a
        // read-only wrapper, so this.data.items.push(x) throws instead of silently
        // mutating. Unfrozen (on_create, on_load's detached run, _apply_load_result)
        // reads return the raw value, because those phases may legally mutate it.
        if (component.__data_frozen && is_wrappable(value)) {
          return create_frozen_wrapper(value, `this.data.${String(prop)}`);
        }
        return value;
      },
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
 * @param dedup_key - The dedup key captured by the caller, or null to run uncoordinated.
 *                    The key is passed in rather than recomputed because args may legally
 *                    change while on_load() runs, and a recomputed key would address a
 *                    different entry than the one this leader registered.
 * @returns The resulting data and optional coordination completion function
 */
export async function execute_on_load_detached(component: any, dedup_key: string | null = null): Promise<{
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

  // Wrapper memo for this one on_load() run. Without it every nested read built a
  // fresh Proxy, so `this.args.filter !== this.args.filter` for an object arg and
  // identity comparisons inside on_load() silently failed. Lives only for the duration
  // of this call - args may legally be replaced between loads.
  const readonly_wrappers = new WeakMap<object, any>();

  const create_readonly_proxy = (obj: any, path: string = 'this.args'): any => {
    if (obj === null || typeof obj !== 'object') return obj;

    const existing = readonly_wrappers.get(obj);
    if (existing) return existing;

    const proxy = new Proxy(obj, {
      get(target: any, prop: string | symbol) {
        const value = target[prop];
        // Recursively wrap nested objects. Functions are returned raw - `typeof value`
        // is already 'object' here, so a function never reaches this branch.
        if (value !== null && typeof value === 'object') {
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

    readonly_wrappers.set(obj, proxy);
    return proxy;
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

  // Register as leader BEFORE on_load() runs, so the error path always finds the entry
  // it has to reject. The completion function is stored, not called here: _load() calls
  // it after _apply_load_result() has updated this.data.
  let complete_coordination: ((data: Record<string, any>) => void) | null = null;
  if (dedup_key !== null) {
    complete_coordination = Load_Coordinator.register_leader(component, dedup_key);
  }

  try {
    await component._call_lifecycle('on_load', restricted_this);
  } catch (error: any) {
    if (dedup_key !== null) {
      Load_Coordinator.handle_leader_error(dedup_key, error as Error);
    }
    throw error;
  }

  // Note: We don't validate args changes here because external code (like parent
  // components calling reload()) is allowed to modify component.args during on_load().
  // The read-only proxy only prevents code INSIDE on_load() from modifying args.

  // Return the data from the detached context AND the completion function
  return {
    data: detached_context.data,
    complete_coordination
  };
}
