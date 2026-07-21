# Lifecycle Method Protection

**Status:** Implemented (Option 2 - WeakMap)
**Date:** 2025-11-26
**Implementation:** `packages/core/src/component.ts`

## Problem

Developers should never manually call lifecycle methods (`on_create`, `on_render`, `on_load`, `on_ready`, `on_stop`). These are hooks meant to be overridden, not invoked directly. Manual calls can cause:

- Race conditions and inconsistent state
- Bypassing deduplication and caching logic
- Confusing behavior when lifecycle expectations are violated

Currently nothing prevents `this.on_load()` from being called in `on_ready()` or anywhere else.

## Goal

Block manual calls to lifecycle methods with clear error messages, while allowing the framework to call them internally. Stack traces should show the correct function name when errors occur inside lifecycle methods.

---

## Option 1: Simple Flag + Wrapper

Store original implementation, replace with guarded wrapper, use flag to authorize internal calls.

```javascript
// In boot(), after component fully constructed
_protect_lifecycle_methods() {
  const methods = {
    on_create: 'Called automatically during creation.',
    on_render: 'Use render() to trigger a re-render.',
    on_load: 'Use reload() to refresh data.',
    on_ready: 'Called automatically when ready.',
    on_stop: 'Use stop() to stop the component.'
  };

  for (const [name, help] of Object.entries(methods)) {
    const original = this[name];
    // Skip if using base class default (empty method)
    if (original === Jqhtml_Component.prototype[name]) continue;

    const self = this;
    // Store original implementation
    this[`__impl_${name}`] = original;
    // Create wrapper with same function name (for stack traces)
    this[name] = {
      [name](...args) {
        if (!self.__lifecycle_authorized) {
          throw new Error(`[JQHTML] ${name}() cannot be called manually. ${help}`);
        }
        return self[`__impl_${name}`].apply(self, args);
      }
    }[name];
  }
}

// When framework calls internally:
async _call_lifecycle(name) {
  this.__lifecycle_authorized = true;
  try {
    return await this[name]();  // Calls wrapper, which calls __impl_
  } finally {
    this.__lifecycle_authorized = false;
  }
}
```

**Pros:**
- Simple implementation
- Clear error messages with helpful alternatives
- Stack traces show correct function name (using `{[name](){}}[name]` trick)
- Fast - just a boolean check

**Cons:**
- Creates extra properties on component (`__impl_on_load`, etc.)
- Properties visible in debugger (though prefixed with `__`)

---

## Option 2: WeakMap Storage (Implemented)

Store original implementations in a WeakMap keyed by component instance.

```javascript
const lifecycle_impls = new WeakMap();

_protect_lifecycle_methods() {
  const impls = {};
  const methods = {
    on_create: 'Called automatically during creation.',
    on_render: 'Use render() to trigger a re-render.',
    on_load: 'Use reload() to refresh data.',
    on_ready: 'Called automatically when ready.',
    on_stop: 'Use stop() to stop the component.'
  };

  for (const [name, help] of Object.entries(methods)) {
    const original = this[name];
    if (original === Jqhtml_Component.prototype[name]) continue;

    impls[name] = original;
    const self = this;
    this[name] = {
      [name](...args) {
        if (!self.__lifecycle_authorized) {
          throw new Error(`[JQHTML] ${name}() cannot be called manually. ${help}`);
        }
        return lifecycle_impls.get(self)[name].apply(self, args);
      }
    }[name];
  }

  lifecycle_impls.set(this, impls);
}

// When framework calls internally:
async _call_lifecycle(name) {
  this.__lifecycle_authorized = true;
  try {
    return await this[name]();
  } finally {
    this.__lifecycle_authorized = false;
  }
}
```

**Pros:**
- Cleaner component object (no `__impl_` properties)
- Original implementations hidden from debugger inspection
- WeakMap automatically garbage collects when component is removed

**Cons:**
- WeakMap lookup overhead (likely negligible, but should benchmark)
- Slightly more complex implementation
- Still need `__lifecycle_authorized` flag on component

---

## Option 3: Symbol Keys

Store original implementations under a Symbol key on the component.

```javascript
const LIFECYCLE = Symbol.for('jqhtml_lifecycle');

_protect_lifecycle_methods() {
  this[LIFECYCLE] = {};
  const methods = {
    on_create: 'Called automatically during creation.',
    on_render: 'Use render() to trigger a re-render.',
    on_load: 'Use reload() to refresh data.',
    on_ready: 'Called automatically when ready.',
    on_stop: 'Use stop() to stop the component.'
  };

  for (const [name, help] of Object.entries(methods)) {
    const original = this[name];
    if (original === Jqhtml_Component.prototype[name]) continue;

    this[LIFECYCLE][name] = original;
    const self = this;
    this[name] = {
      [name](...args) {
        if (!self.__lifecycle_authorized) {
          throw new Error(`[JQHTML] ${name}() cannot be called manually. ${help}`);
        }
        return self[LIFECYCLE][name].apply(self, args);
      }
    }[name];
  }
}

// When framework calls internally:
async _call_lifecycle(name) {
  this.__lifecycle_authorized = true;
  try {
    return await this[name]();
  } finally {
    this.__lifecycle_authorized = false;
  }
}
```

**Pros:**
- Symbol key hidden from normal enumeration (`for...in`, `Object.keys()`)
- Feels more idiomatic to modern JavaScript
- Single property holds all implementations

**Cons:**
- Still accessible via `Object.getOwnPropertySymbols()` (not about security anyway)
- Symbol.for() creates global registry entry
- Slightly more indirection than Option 1

---

## Implementation Notes

### Timing

Protection must be applied in `boot()` or early in `create()`, AFTER the component is fully constructed. This is because:

1. User's class extends `Jqhtml_Component`
2. User's methods are defined on prototype or in constructor
3. We can only wrap them after they exist

### Stack Trace Preservation

The `{[name](...args){}}[name]` pattern creates a function with a dynamic name:

```javascript
// This creates an anonymous function:
const fn = function(...args) { };  // fn.name === ''

// This creates a named function:
const fn = { myMethod(...args) { } }.myMethod;  // fn.name === 'myMethod'

// With dynamic name:
const name = 'on_load';
const fn = { [name](...args) { } }[name];  // fn.name === 'on_load'
```

This ensures stack traces show `on_load` instead of `anonymous` or a wrapper name.

### Error Messages

Each lifecycle method should have a helpful error message suggesting the correct alternative:

| Method | Suggestion |
|--------|------------|
| `on_create` | Called automatically during creation. |
| `on_render` | Use `render()` to trigger a re-render. |
| `on_load` | Use `reload()` to refresh data. |
| `on_ready` | Called automatically when ready. |
| `on_stop` | Use `stop()` to stop the component. |

---

## Benchmarking

Before finalizing, benchmark WeakMap lookup vs direct property access:

```javascript
// Benchmark script
const iterations = 1000000;

// Option 1: Direct property
const obj1 = { __impl_on_load: () => {} };
console.time('Direct property');
for (let i = 0; i < iterations; i++) {
  obj1.__impl_on_load();
}
console.timeEnd('Direct property');

// Option 2: WeakMap
const map = new WeakMap();
const obj2 = {};
map.set(obj2, { on_load: () => {} });
console.time('WeakMap lookup');
for (let i = 0; i < iterations; i++) {
  map.get(obj2).on_load();
}
console.timeEnd('WeakMap lookup');

// Option 3: Symbol
const SYM = Symbol('lifecycle');
const obj3 = { [SYM]: { on_load: () => {} } };
console.time('Symbol property');
for (let i = 0; i < iterations; i++) {
  obj3[SYM].on_load();
}
console.timeEnd('Symbol property');
```

Run in browser console or Node.js to compare. Expected: all three are fast enough that the difference is negligible for real-world usage (lifecycle methods called ~5 times per component, not millions).

---

## Decision

**Option 2 (WeakMap) was implemented.**

Benchmark results (`benchmark.js`) showed Option 2 is approximately 12% faster than Option 1, though both are negligible in real-world usage. The WeakMap approach was chosen for:

- Cleaner component object (no visible `__impl_` properties)
- Better debugger experience
- Automatic garbage collection when components are removed
- Slight performance advantage

---

## Future Considerations

- Could extend this pattern to other methods that shouldn't be called manually
- Could add development-only checks that are stripped in production builds
- Could use TypeScript's `private` or `#privateField` syntax if we move to class fields
