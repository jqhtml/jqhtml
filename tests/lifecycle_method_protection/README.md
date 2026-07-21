# Lifecycle Method Protection Test

## Purpose

This test validates that JQHTML lifecycle methods (`on_create`, `on_render`, `on_load`, `on_ready`, `on_stop`) cannot be called manually by developer code, while still executing correctly when called by the framework.

## Problem Being Solved

Developers should never manually call lifecycle methods. These are hooks meant to be overridden, not invoked directly. Manual calls can cause:

- Race conditions and inconsistent state
- Bypassing deduplication and caching logic
- Confusing behavior when lifecycle expectations are violated

## What This Test Validates

### Protection Tests (Tests 1-5)

Each lifecycle method is tested to ensure manual calls throw an error:

| Test | Method | Expected Error |
|------|--------|----------------|
| 1 | `on_create()` | "on_create() cannot be called manually" |
| 2 | `on_load()` | "on_load() cannot be called manually" |
| 3 | `on_ready()` | "on_ready() cannot be called manually" |
| 4 | `on_render()` | "on_render() cannot be called manually" |
| 5 | `on_stop()` | "on_stop() cannot be called manually" |

### Framework Execution Test (Test 6)

Verifies that lifecycle methods still execute correctly when called by the framework:

- `on_create()` sets initial state
- `on_render()` called after DOM update
- `on_load()` fetches data
- `on_ready()` called when component ready
- Data from `on_load()` is available in `on_ready()`

### Cross-Component Protection Test (Test 7)

Verifies that a parent component cannot call lifecycle methods on a child component. This ensures the protection works across component boundaries.

## Running the Test

```bash
cd tests/lifecycle_method_protection
./run-test.sh
```

## Implementation

The lifecycle protection is implemented in `packages/core/src/component.ts` using Option 2 (WeakMap storage). See `DESIGN.md` for implementation details and alternatives considered.

## Additional Files

### DESIGN.md

Documents the three implementation options considered:

1. **Option 1: Direct Property Storage** - Store originals as `__impl_on_load`, etc.
2. **Option 2: WeakMap Storage** (Implemented) - Store originals in module-level WeakMap
3. **Option 3: Symbol Keys** - Store originals under Symbol property

Option 2 was chosen for:
- Cleaner component object (no visible `__impl_` properties)
- Better debugger experience
- Automatic garbage collection
- Slight performance advantage (~12% faster in benchmarks)

### benchmark.js

Performance benchmark comparing Option 1 vs Option 2. Run with:

```bash
node benchmark.js
```

Results show Option 2 (WeakMap) is approximately 12% faster than Option 1 (direct property), though both are negligible in real-world usage (~25 microseconds difference for 100 components).

## Related Source Files

- `packages/core/src/component.ts` - Implementation in `_protect_lifecycle_methods()`, `_call_lifecycle()`, `_call_lifecycle_sync()`
