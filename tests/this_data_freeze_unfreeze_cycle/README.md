# this.data Freeze/Unfreeze Cycle Test

## Purpose

Validates the `this.data` freeze/unfreeze behavior across component lifecycle (v2.2.200+).

## What This Tests

### 1. this.data Writable in on_create()

During `on_create()`, `this.data` should be writable to allow setting initial defaults:

```javascript
on_create() {
  this.data.initial = 'created';  // ✅ Should succeed
  this.data.created_at = Date.now();
}
```

### 2. this.data Frozen After on_create()

After `on_create()` completes, `this.data` is frozen. Any attempt to modify should throw an error:

```javascript
on_render() {
  this.data.rendered = 'should_fail';  // ❌ Should throw error
}
```

### 3. this.data Unfrozen During on_load()

During `on_load()`, `this.data` is unfrozen to allow loading data from APIs:

```javascript
async on_load() {
  this.data.loaded = 'from_api';  // ✅ Should succeed
  this.data.loaded_at = Date.now();
}
```

### 4. this.data Frozen After on_load()

After `on_load()` completes, `this.data` is frozen again:

```javascript
on_ready() {
  this.data.ready = 'should_fail';  // ❌ Should throw error
}
```

### 5. Data Persists Correctly

Values set during writable phases should persist:

- `this.data.initial` from `on_create()` ✅ present
- `this.data.loaded` from `on_load()` ✅ present
- `this.data.rendered` from `on_render()` attempt ❌ absent (threw error)
- `this.data.ready` from `on_ready()` attempt ❌ absent (threw error)

## Expected Output

```
THIS.DATA FREEZE/UNFREEZE CYCLE TEST:

TEST 1: Modifying this.data in on_create()
✅ PASS: Successfully set this.data.initial and this.data.created_at

TEST 2: Attempting to modify this.data in on_render() (after on_create)
✅ PASS: Cannot modify this.data in on_render(): [Error message]

TEST 3: Modifying this.data in on_load()
✅ PASS: Successfully set this.data.loaded and this.data.loaded_at

TEST 4: Attempting to modify this.data in on_ready() (after on_load)
✅ PASS: Cannot modify this.data in on_ready(): [Error message]

TEST 5: Verifying data persistence
  this.data.initial: created ✅
  this.data.loaded: from_api ✅
  this.data.rendered: undefined (should be undefined) ✅
  this.data.ready: undefined (should be undefined) ✅
✅ PASS: Data persists correctly

FINAL RESULT:
✅ ALL FREEZE/UNFREEZE TESTS PASSED
   - this.data writable in on_create()
   - this.data frozen after on_create()
   - this.data writable in on_load()
   - this.data frozen after on_load()
   - Data persists correctly
```

## Why This Matters

The freeze/unfreeze cycle enforces strict lifecycle discipline:

1. **Prevents accidental state mutations** - Can't accidentally modify data in the wrong lifecycle phase
2. **Forces clean data-fetching** - Data loading must happen in `on_load()`
3. **Enables predictable re-renders** - Framework knows when data changed (only during `on_load()`)
4. **Catches bugs early** - Runtime errors instead of silent state corruption

## Implementation Details

**Lifecycle Phases:**

| Phase | this.data State | Purpose |
|-------|----------------|---------|
| Constructor | Unfrozen | Initial setup |
| on_create() | Writable | Set initial defaults |
| After on_create() | **FROZEN** | Prevent mutations |
| Before on_load() | Restored to on_create() snapshot | Clean state |
| During on_load() | **UNFROZEN** | Load API data |
| After on_load() | **FROZEN** | Prevent mutations |
| on_render() | Frozen | DOM updates only |
| on_ready() | Frozen | Event binding, DOM manipulation |

**Error thrown when frozen:**
```
TypeError: Cannot add property X, object is not extensible
```

Or similar proxy-based error depending on implementation.

## Documentation Reference

- CLAUDE.md: "Lifecycle Restrictions (v2.2.200+)" section
- Official docs: Component lifecycle specification

## Files

- `test.jqhtml` - Main test entry point
- `data_freeze_test.jqhtml` - Component template
- `data_freeze_test.js` - Component with freeze/unfreeze validation
- `run-test.sh` - Test runner script
