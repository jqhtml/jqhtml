# render() vs reload() Behavior Test

## Purpose

Validates the distinction between `render()` (re-render current data) and `reload()` (re-fetch data from `on_load()`).

## What This Tests

### 1. render() Does NOT Call on_load()

`render()` re-renders the component with existing `this.data`:

```javascript
async on_ready() {
  // Modify data directly
  this.data.count = 42;

  // Re-render without fetching
  await this.render();  // Does NOT call on_load()
}
```

**Use case:** Update UI when data changes programmatically without needing to re-fetch from API.

### 2. reload() DOES Call on_load()

`reload()` re-fetches data by calling `on_load()`:

```javascript
async on_ready() {
  // Change filter
  this.args.filter = 'active';

  // Re-fetch with new filter
  await this.reload();  // DOES call on_load()
}
```

**Use case:** Refresh data from API with updated parameters.

### 3. Both Call on_ready()

Both methods call `on_ready()` after re-rendering:

```javascript
on_load_count:  1 → 1 → 2
on_ready_count: 1 → 2 → 3

// After initial boot → render() → reload()
```

## Expected Output

```
on_load called (count: 1)

on_ready called (count: 1)

TEST 1: Initial state after first boot
  on_load_count: 1 (expected: 1)
  on_ready_count: 1 (expected: 1)
✅ PASS: Initial lifecycle completed correctly

Calling render()...

on_ready called (count: 2)

TEST 2: After render() completed
  on_load_count: 1 (expected: 1, NOT incremented)
  on_ready_count: 2 (expected: 2)
✅ PASS: render() did NOT call on_load()

Calling reload()...

on_load called (count: 2)

on_ready called (count: 3)

TEST 3: After reload() completed
  on_load_count: 2 (expected: 2, incremented)
  on_ready_count: 3 (expected: 3)
✅ PASS: reload() DID call on_load()

FINAL RESULT:
✅ ALL RENDER/RELOAD TESTS PASSED
   - render() does NOT call on_load()
   - reload() DOES call on_load()
   - Both call on_ready()
```

## Why This Matters

**Different use cases:**

| Method | Use Case | Calls on_load() | When to Use |
|--------|----------|----------------|-------------|
| `render()` | UI update with current data | ❌ No | Data changed programmatically |
| `reload()` | Refresh from API | ✅ Yes | Need fresh data from server |

**Example scenarios:**

```javascript
// Scenario 1: Programmatic data change
toggle_visibility() {
  this.data.visible = !this.data.visible;
  this.render();  // Just update UI
}

// Scenario 2: Refresh button
async refresh() {
  await this.reload();  // Re-fetch from API
}

// Scenario 3: Filter change
async change_filter(filter) {
  this.args.filter = filter;
  await this.reload();  // Re-fetch with new filter
}
```

## Implementation Details

**render() process:**
1. Re-render template with current `this.data`
2. Wait for children to be ready
3. Call `on_ready()`
4. **Does NOT** call `on_load()`

**reload() process:**
1. Restore `this.data` to `on_create()` snapshot
2. **Call `on_load()`** to re-fetch data
3. Re-render if data changed
4. Wait for children to be ready
5. Call `on_ready()`

## Documentation Reference

- CLAUDE.md: "Lifecycle Manipulation Methods" section
- CLAUDE.md: "Method Comparison" table

## Files

- `test.jqhtml` - Main test entry point
- `render_reload_test.jqhtml` - Component template
- `render_reload_test.js` - Component with lifecycle tracking
- `run-test.sh` - Test runner script
