/**
 * JQHTML Data Proxy System
 *
 * Extracted from component.ts - handles:
 * - Data freeze/unfreeze enforcement via Proxy
 * - Detached on_load() / on_load_error() execution with restricted access
 */

import { Load_Coordinator } from './load-coordinator.js';
import { Jqhtml_Local_Storage } from './local-storage.js';

/**
 * `this.data[RAW_DATA]` is the RAW object behind the freeze proxy. Framework code
 * that only READS the whole of this.data (serializing it for change detection) goes
 * through it, so it does not build a read-only wrapper for every nested object it
 * walks while this.data is frozen. A symbol: no key in author data can collide with
 * it, and Object.keys / for..in / JSON never see it.
 */
export const RAW_DATA: unique symbol = Symbol('jqhtml.raw_data');

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

// ============================================================================
// Deep-freeze wrappers
// ============================================================================
//
// While this.data is frozen, every plain object or array read out of it is handed out
// through a read-only wrapper. All wrappers of one component share ONE handler (built
// once, in setup_data_property()); what a trap needs to know about its target lives in
// the component's side table, keyed by the raw target. A wrapper costs one Proxy and
// one WeakMap entry - no closures of its own, and no path string built on a read. The
// path is assembled from the side table only when a mutation is rejected and the error
// message needs it.
//
// The side table is per component, not module-wide: a single module-wide WeakMap
// holding every wrapper of every component measured slower than the per-object
// closures it replaced (a large, long-lived WeakMap is costly to grow and to sweep).

/**
 * A wrapped object's read-only wrapper, and where it was first read from: its raw
 * parent and the key under it (the error path is rebuilt from these on demand).
 */
interface Frozen_Entry {
  wrapper: any;
  parent: object;
  key: string | symbol;
}

// Keyed by the RAW target. A value read twice returns the same wrapper, so
// `this.data.items === this.data.items` holds - identity comparisons and `Set`/`Map`
// membership on nested data keep working. A WeakMap: an entry dies with its object.
type Frozen_Table = WeakMap<object, Frozen_Entry>;

// Only plain objects and arrays are wrapped. Anything with a real prototype
// (Date, Map, Set, and classes restored by register_cache_class()) carries internal
// slots that a Proxy receiver cannot satisfy: `this.data.created.getTime()` would
// call the method with the proxy as `this` and throw. Those values pass through raw -
// a shallow hole we accept, because breaking Date/Map/Set reads would be worse than
// missing a rare mutation of one.
function is_wrappable(value: any): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return true;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// One path segment: array indices read as [0], keys as .name
function path_segment(parent: object, key: string | symbol): string {
  return Array.isArray(parent) ? `[${String(key)}]` : `.${String(key)}`;
}

/**
 * Dotted path of a raw object (or of `key` under it) inside this.data, for error
 * messages only. Walks the side table up to this.data itself (the one object with no
 * entry). An entry is recorded once, when its wrapper is first created, and a parent
 * is always wrapped (or is this.data) before its child, so the chain is finite; the
 * depth cap is a guard, not a code path.
 */
function frozen_path(table: Frozen_Table, target: object, key?: string | symbol): string {
  let path = key === undefined ? '' : path_segment(target, key);
  let obj: object = target;
  for (let depth = 0; depth < 1000; depth++) {
    const entry = table.get(obj);
    if (!entry) break;
    path = path_segment(entry.parent, entry.key) + path;
    obj = entry.parent;
  }
  return 'this.data' + path;
}

type Frozen_Verb = 'modify' | 'delete' | 'define' | 'change the prototype of' | 'prevent extensions on';

function frozen_violation(component: any, path: string, verb: Frozen_Verb, value?: any): never {
  const value_text = verb === 'modify' ? ` = ${safe_json(value)}` : '';
  const attempt = verb === 'modify' || verb === 'delete'
    ? `${verb === 'delete' ? 'delete ' : ''}${path}${value_text}`
    : verb === 'define' ? `Object.defineProperty(${path}, ...)`
    : verb === 'change the prototype of' ? `Object.setPrototypeOf(${path}, ...)`
    : `Object.freeze(${path})`;
  console.error(
    `[JQHTML] ERROR: Component "${component.component_name()}" attempted to ${verb} ${path} outside of on_create() or on_load().\n\n` +
    `RESTRICTION: this.data can ONLY be modified in:\n` +
    `  - on_create() (set initial defaults, synchronous only)\n` +
    `  - on_load() (fetch data from APIs, can be async)\n\n` +
    `NESTED VALUES COUNT: the freeze is DEEP. Mutating an object or array inside\n` +
    `this.data (push, splice, assigning a property, delete) is modifying this.data.\n\n` +
    `WHY: this.data represents loaded state. Modifying it outside these methods bypasses the framework's render cycle.\n\n` +
    `FIX:\n` +
    `  ❌ In on_ready(): ${attempt};\n` +
    `  ✅ In on_load(): fetch the value, so the framework can re-render\n` +
    `  ✅ For component-local bookkeeping: this.state (unrestricted, never cached)`
  );

  throw new Error(
    `[JQHTML] Cannot ${verb} ${path} outside of on_create() or on_load(). ` +
    `this.data is frozen after on_create() and unfrozen only during on_load(). ` +
    `The freeze is deep - nested objects and arrays are frozen too.`
  );
}

/**
 * Set up the `this.data` property on a component using Object.defineProperty
 * with a Proxy that enforces freeze/unfreeze semantics.
 *
 * After setup:
 * - `this.data` reads/writes go through a Proxy
 * - When `component.__data_frozen === true`, every mutation route throws: assignment,
 *   delete, Object.defineProperty, Object.setPrototypeOf, Object.preventExtensions /
 *   seal / freeze - on this.data and, through the read-only wrappers, on anything
 *   nested in it. A property descriptor's value is the read-only wrapper too.
 * - When frozen is false, writes pass through normally
 *
 * @param component - The component instance to set up data on
 */
export function setup_data_property(component: any): void {
  const table: Frozen_Table = new WeakMap();

  // The read-only wrapper of a plain object or array, memoized in the side table.
  const wrap = (value: object, parent: object, key: string | symbol): any => {
    const existing = table.get(value);
    if (existing) return existing.wrapper;
    const wrapper = new Proxy(value, frozen_handler);
    table.set(value, { wrapper, parent, key });
    return wrapper;
  };

  // A property descriptor whose value is a nested object hands out the read-only
  // wrapper, not the raw object - otherwise `Object.getOwnPropertyDescriptor(this.data,
  // 'items').value.push(x)` would reach frozen data. A non-writable, non-configurable
  // property must report its exact value (a Proxy invariant), so that one stays raw.
  const frozen_descriptor = (target: object, prop: string | symbol): PropertyDescriptor | undefined => {
    const desc = Reflect.getOwnPropertyDescriptor(target, prop);
    if (desc && is_wrappable(desc.value) && (desc.configurable || desc.writable)) {
      desc.value = wrap(desc.value, target, prop);
    }
    return desc;
  };

  // Read-only view of a nested value. Handed out ONLY while __data_frozen is true (the
  // top-level traps check), so these traps never re-check: a wrapper the author kept a
  // reference to stays read-only for its whole life.
  const frozen_handler: ProxyHandler<any> = {
    get(target, prop) {
      const value = target[prop];
      // Functions are returned raw: array methods are invoked with the wrapper as
      // `this`, so push/splice still land in this handler's set/deleteProperty.
      return is_wrappable(value) ? wrap(value, target, prop) : value;
    },
    getOwnPropertyDescriptor: frozen_descriptor,
    set(target, prop, value) {
      return frozen_violation(component, frozen_path(table, target, prop), 'modify', value);
    },
    deleteProperty(target, prop) {
      return frozen_violation(component, frozen_path(table, target, prop), 'delete');
    },
    defineProperty(target, prop) {
      return frozen_violation(component, frozen_path(table, target, prop), 'define');
    },
    setPrototypeOf(target) {
      return frozen_violation(component, frozen_path(table, target), 'change the prototype of');
    },
    preventExtensions(target) {
      return frozen_violation(component, frozen_path(table, target), 'prevent extensions on');
    }
  };

  // The top-level handler, reused by every data generation (each assignment to
  // this.data wraps the new object with it).
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop) {
      if (prop === RAW_DATA) return target;
      const value = target[prop as keyof typeof target];
      // Deep freeze: while frozen, every nested object/array is read through a
      // read-only wrapper, so this.data.items.push(x) throws instead of silently
      // mutating. Unfrozen (on_create, on_load's detached run, _apply_load_result)
      // reads return the raw value, because those phases may legally mutate it.
      if (component.__data_frozen && is_wrappable(value)) {
        return wrap(value, target, prop);
      }
      return value;
    },
    getOwnPropertyDescriptor(target, prop) {
      if (component.__data_frozen) return frozen_descriptor(target, prop);
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    set(target, prop, value) {
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
      component.__data_text = null;  // this.data changed: its serialized text is stale
      return true;
    },
    deleteProperty(target, prop) {
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
      component.__data_text = null;  // this.data changed: its serialized text is stale
      return true;
    },
    defineProperty(target, prop, descriptor) {
      if (component.__data_frozen) return frozen_violation(component, frozen_path(table, target, prop), 'define');
      const ok = Reflect.defineProperty(target, prop, descriptor);
      component.__data_text = null;  // this.data changed: its serialized text is stale
      return ok;
    },
    setPrototypeOf(target, proto) {
      if (component.__data_frozen) return frozen_violation(component, 'this.data', 'change the prototype of');
      const ok = Reflect.setPrototypeOf(target, proto);
      component.__data_text = null;
      return ok;
    },
    preventExtensions(target) {
      if (component.__data_frozen) return frozen_violation(component, 'this.data', 'prevent extensions on');
      return Reflect.preventExtensions(target);
    }
  };

  let _data: Record<string, any> = new Proxy({}, handler);

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
      _data = new Proxy(value, handler);
      component.__data_text = null;  // A new data generation: its text is computed afresh
    },
    enumerable: true,
    configurable: false
  });
}

/**
 * `this[LOAD_HOOK_OWNER]` on the restricted `this` of on_load()/on_load_error() is the
 * real component. Framework code reached from inside the hook - the base
 * on_load_error(), called by an override through super - uses it to name the
 * component. A module symbol: author code cannot reach it, and the restriction on
 * every other property stays in force.
 */
export const LOAD_HOOK_OWNER: unique symbol = Symbol('jqhtml.load_hook_owner');

/**
 * Build the restricted `this` that on_load() and on_load_error() run against.
 *
 * Creates a sandboxed environment where the hook can only access:
 * - this.args (read-only)
 * - this.data (read/write, a fresh copy of the on_create() snapshot)
 *
 * All other property access (this.$, this.$sid, etc.) throws errors.
 *
 * @param component - The component instance
 * @param hook - The hook name used in the error messages ('on_load' or 'on_load_error')
 */
function create_detached_context(component: any, hook: string): { restricted_this: any; detached_context: any } {
  // A fresh copy of this.data as on_create() left it. The snapshot is the cache
  // serializer's text (Jqhtml_Local_Storage.snapshot()), so a Date, Map, Set,
  // register_cache_class() instance or key holding undefined comes back as exactly
  // that - not as the string / {} / missing key a JSON copy produced.
  const data_clone = component.__initial_data_text !== null
    ? (Jqhtml_Local_Storage.restore_snapshot(component.__initial_data_text) ?? {})
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
          `[JQHTML] ERROR: Component "${component_name}" attempted to modify ${path}.${String(prop)} during ${hook}().\n\n` +
          `RESTRICTION: this.args is READ-ONLY during ${hook}().\n\n` +
          `WHY: this.args configures what data to fetch. Modifying it during ${hook}() creates circular dependencies.\n\n` +
          `FIX: Modify this.args BEFORE ${hook}() runs (in on_create() or before calling reload()):\n` +
          `  ❌ Inside ${hook}(): ${path}.${String(prop)} = ${JSON.stringify(value)};\n` +
          `  ✅ In on_create(): this.args.${String(prop)} = defaultValue;`
        );
        throw new Error(
          `[JQHTML] Cannot modify ${path}.${String(prop)} during ${hook}(). ` +
          `this.args is read-only in ${hook}().`
        );
      },
      deleteProperty(_target: any, prop: string | symbol) {
        console.error(
          `[JQHTML] ERROR: Component "${component_name}" attempted to delete ${path}.${String(prop)} during ${hook}().\n\n` +
          `RESTRICTION: this.args is READ-ONLY during ${hook}().`
        );
        throw new Error(
          `[JQHTML] Cannot delete ${path}.${String(prop)} during ${hook}(). ` +
          `this.args is read-only in ${hook}().`
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
      if (prop === LOAD_HOOK_OWNER) {
        return component;
      }

      // Block everything else
      console.error(
        `[JQHTML] ERROR: Component "${component_name}" attempted to access this.${String(prop)} during ${hook}().\n\n` +
        `RESTRICTION: ${hook}() may ONLY access:\n` +
        `  - this.args (read-only)\n` +
        `  - this.data (read/write)\n\n` +
        `WHY: ${hook}() is for data fetching only. All other component functionality should happen in other lifecycle methods.\n\n` +
        `FIX:\n` +
        `  - DOM manipulation → use on_render() or on_ready()\n` +
        `  - Component methods → call them before/after ${hook}(), not inside it\n` +
        `  - Other properties → restructure code to only use this.args and this.data in ${hook}()`
      );

      throw new Error(
        `[JQHTML] Cannot access this.${String(prop)} during ${hook}(). ` +
        `${hook}() may only access this.args and this.data.`
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
          `[JQHTML] ERROR: Component "${component_name}" attempted to modify this.args during ${hook}().\n\n` +
          `RESTRICTION: ${hook}() may ONLY modify:\n` +
          `  - this.data (read/write)\n\n` +
          `WHY: this.args is component state that ${hook}() depends on. Modifying it inside ${hook}() creates circular dependencies.\n\n` +
          `FIX: Modify this.args BEFORE calling ${hook}() (in on_create() or other lifecycle methods), not inside ${hook}():\n` +
          `  ❌ Inside ${hook}(): this.args.filter = 'new_value';\n` +
          `  ✅ In on_create(): this.args.filter = this.args.initial_filter || 'default';`
        );

        throw new Error(
          `[JQHTML] Cannot modify this.args during ${hook}(). ` +
          `Modify this.args in other lifecycle methods, not inside ${hook}().`
        );
      }

      // Block setting any other properties
      console.error(
        `[JQHTML] ERROR: Component "${component_name}" attempted to modify this.${String(prop)} during ${hook}().\n\n` +
        `RESTRICTION: ${hook}() may ONLY modify:\n` +
        `  - this.data (read/write)\n\n` +
        `WHY: ${hook}() is for data fetching only. Setting properties on the component instance should happen in other lifecycle methods.\n\n` +
        `FIX: Store your data in this.data instead:\n` +
        `  ❌ this.${String(prop)} = value;\n` +
        `  ✅ this.data.${String(prop)} = value;`
      );

      throw new Error(
        `[JQHTML] Cannot modify this.${String(prop)} during ${hook}(). ` +
        `Only this.data can be modified in ${hook}().`
      );
    }
  });

  return { restricted_this, detached_context };
}

/**
 * Execute on_load() in a detached context with restricted access (see
 * create_detached_context()).
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
  complete_coordination: ((final_text: string | null) => void) | null;
}> {
  const { restricted_this, detached_context } = create_detached_context(component, 'on_load');

  // Register as leader BEFORE on_load() runs, so the error path always finds the entry
  // it has to reject. The completion function is stored, not called here: _load() calls
  // it after _apply_load_result() has updated this.data.
  let complete_coordination: ((final_text: string | null) => void) | null = null;
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

/**
 * Execute an on_load_error() override in the same detached context as on_load(): read
 * this.args, write this.data (starting again from the on_create() snapshot), nothing
 * else. Never coordinated - fallback data is never handed to deduplication followers.
 *
 * @returns The data the hook left in this.data (the fallback); throws what the hook throws
 */
export async function execute_on_load_error_detached(component: any, error: any): Promise<Record<string, any>> {
  const { restricted_this, detached_context } = create_detached_context(component, 'on_load_error');
  await component._call_lifecycle('on_load_error', restricted_this, [error]);
  return detached_context.data;
}
