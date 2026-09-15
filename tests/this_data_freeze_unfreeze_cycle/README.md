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

### 2. this.data Frozen After on_create() - DEEPLY

After `on_create()` completes, `this.data` is frozen. Any attempt to modify should throw
an error, and the freeze reaches nested objects and arrays:

```javascript
on_render() {
  this.data.rendered = 'should_fail';     // ❌ Should throw error
  this.data.nested.list.push(99);         // ❌ Should throw too (deep freeze)
}
```

### 3. this.data Unfrozen During on_load()

During `on_load()`, `this.data` is unfrozen to allow loading data from APIs:

```javascript
async on_load() {
  this.data.loaded = 'from_api';   // ✅ Should succeed
  this.data.loaded_at = Date.now();
  this.data.nested.list.push(3);   // ✅ Nested writes are unfrozen here too
}
```

### 4. this.data Frozen After on_load()

After `on_load()` completes, `this.data` is frozen again:

```javascript
on_ready() {
  this.data.ready = 'should_fail';            // ❌ Should throw error
  this.data.nested.list.push(99);             // ❌ Nested push throws
  this.data.nested.user.name = 'z';           // ❌ Nested assignment throws
  delete this.data.nested.user.name;          // ❌ Nested delete throws
  this.data.nested.list[0] = 42;              // ❌ Index assignment throws
}
```

### 5. Data Persists Correctly

Values set during writable phases should persist:

- `this.data.initial` from `on_create()` ✅ present
- `this.data.loaded` from `on_load()` ✅ present
- `this.data.nested` reflects `[1,2,3]` and `user.name === 'b'` — the `on_create()` and
  `on_load()` writes, and nothing else ✅
- `this.data.rendered` from `on_render()` attempt ❌ absent (threw error)
- `this.data.ready` from `on_ready()` attempt ❌ absent (threw error)

### 6. Where the Test's Own Bookkeeping Lives

The assertion log is `this.state.test_results`, because it is appended from `on_render()`
and `on_ready()` where `this.data` is frozen — a `push()` into an array inside `this.data`
throws exactly like an assignment. `on_load()` can reach neither `this.state` nor any other
property, so its outcome is carried out through `this.data` and turned into results in
`on_ready()`.

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

The freeze is **deep**: while frozen, reading a nested object or array out of `this.data`
returns a read-only view, so `push`, `splice`, nested assignment and `delete` all throw.
The error message names the dotted path (`this.data.nested.list[0]`). Reads are unaffected
— `JSON.stringify`, `Array.isArray`, `for..of`, `.map`/`.filter`, `Object.keys` and
identity (`this.data.x === this.data.x`) behave exactly as before.

**Error thrown when frozen:**
```
[JQHTML] Cannot modify this.data.nested.list[0] outside of on_create() or on_load().
this.data is frozen after on_create() and unfrozen only during on_load().
The freeze is deep - nested objects and arrays are frozen too.
```

## Documentation Reference

- CLAUDE.md: "Lifecycle Restrictions (v2.2.200+)" section
- Official docs: Component lifecycle specification

## Files

- `test.jqhtml` - Main test entry point
- `data_freeze_test.jqhtml` - Component template
- `data_freeze_test.js` - Component with freeze/unfreeze validation
- `run-test.sh` - Test runner script
