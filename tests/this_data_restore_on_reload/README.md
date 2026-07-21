# this.data Restore on reload() Test

## Purpose

Verifies that `this.data` is restored to `on_create()` snapshot before each `on_load()` call, ensuring clean state for data reloading.

## What This Tests

### 1. First on_load() Starts with on_create() Defaults

Initial component load should start with `this.data` in the state set by `on_create()`:

```javascript
on_create() {
  this.data.counter = 0;  // Initial default
  this.data.initial_value = 'from_create';
}

async on_load() {
  // Starts with counter = 0
  this.data.counter++;  // Now counter = 1
}
```

### 2. reload() Restores this.data Before Re-running on_load()

When `reload()` is called, `this.data` should be restored to the `on_create()` snapshot before `on_load()` executes again:

```javascript
async on_ready() {
  // After first on_load(): counter = 1
  await this.reload();
  // After reload: counter = 1 again (NOT 2)
  // Because this.data was reset to {counter: 0} before on_load() ran
}
```

**Key Behavior:**
- `reload()` → restore `this.data` to `on_create()` state → call `on_load()` → increment counter to 1
- Counter does NOT accumulate across reloads
- Each `on_load()` starts fresh with `on_create()` defaults

### 3. Initial Values Persist

Values set in `on_create()` should be present in every `on_load()` execution:

```javascript
on_create() {
  this.data.initial_value = 'from_create';
}

async on_load() {
  // this.data.initial_value is always 'from_create'
}
```

## Expected Output

```
THIS.DATA RESTORE ON RELOAD TEST:

on_create() - Initial this.data:
{
  "initial_value": "from_create",
  "counter": 0,
  "test_results": []
}

on_load() START - this.data:
{
  "initial_value": "from_create",
  "counter": 0,
  "test_results": []
}

on_load() END - this.data:
{
  "initial_value": "from_create",
  "counter": 1,
  "loaded_value": "load_1",
  "test_results": []
}

on_ready() - this.data:
{
  "initial_value": "from_create",
  "counter": 1,
  "loaded_value": "load_1",
  "test_results": [...]
}

✅ TEST 1 PASS: First on_load() counter = 1

Calling reload()...

on_load() START - this.data:
{
  "initial_value": "from_create",
  "counter": 0,           <-- RESTORED to 0
  "test_results": []
}

on_load() END - this.data:
{
  "initial_value": "from_create",
  "counter": 1,           <-- Incremented to 1 again
  "loaded_value": "load_1",
  "test_results": []
}

After reload() - this.data:
{
  "initial_value": "from_create",
  "counter": 1,           <-- Still 1 (not 2!)
  "loaded_value": "load_1",
  "test_results": [...]
}

✅ TEST 2 PASS: After reload() counter still = 1 (data was restored)
✅ TEST 3 PASS: initial_value persists across reload

FINAL RESULT:
✅ ALL RESTORE TESTS PASSED
   - First on_load() starts with on_create() defaults
   - reload() restores this.data before re-running on_load()
   - Counter resets to 0, then increments to 1 again
   - initial_value persists correctly
```

## Why This Matters

**Clean state for data reloading:**
- Prevents data from previous loads from polluting new loads
- Ensures `on_load()` always starts with predictable state
- Allows `on_load()` to use `on_create()` defaults reliably

**Use case example:**
```javascript
on_create() {
  this.data.page = 1;
  this.data.items = [];
}

async on_load() {
  // Always starts with page=1, items=[]
  const response = await fetch(`/api/items?page=${this.args.page || this.data.page}`);
  this.data.items = response.items;
}

async on_ready() {
  this.$sid('next_page').on('click', async () => {
    this.args.page = 2;
    await this.reload();  // this.data.items cleared before fetching page 2
  });
}
```

## Implementation Details

**Restore Process:**
1. Component stores snapshot of `this.data` after `on_create()` completes
2. When `reload()` called, restore `this.data` from snapshot
3. Call `on_load()` with clean state
4. `on_load()` populates `this.data` fresh

**What gets restored:**
- All properties set in `on_create()`
- Values reset to exact state after `on_create()` completed

**What doesn't get restored:**
- `this.args` (not affected by restore)
- Component properties outside `this.data`

## Documentation Reference

- CLAUDE.md: "Lifecycle Restrictions (v2.2.200+)" - documents restore behavior
- CLAUDE.md: "reload() - Re-fetch Data and Re-render" section

## Files

- `test.jqhtml` - Main test entry point
- `data_restore_test.jqhtml` - Component template
- `data_restore_test.js` - Component with restore validation
- `run-test.sh` - Test runner script
