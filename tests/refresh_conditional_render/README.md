# refresh() Conditional Rendering Test

Tests that `refresh()` only re-renders when data changes, while `reload()` always re-renders.

## What This Tests

1. **refresh() with no data change** - Should NOT re-render
2. **refresh() with data change** - Should re-render
3. **reload() always re-renders** - Even when data doesn't change
4. **Debounce precedence** - reload(true) takes precedence over refresh()/reload(false)
5. **Render count tracking** - Validates that skipped renders don't increment render count

## Test Scenarios

### Scenario 1: refresh() with unchanged data
1. Component renders with `count: 1`
2. Call `refresh()` - `on_load()` sets `count: 1` again (no change)
3. **Expected**: NO re-render (render count stays same)

### Scenario 2: refresh() with changed data
1. Component renders with `count: 1`
2. Server changes data to `count: 2`
3. Call `refresh()` - `on_load()` sets `count: 2` (changed)
4. **Expected**: Re-render occurs (render count increments)

### Scenario 3: reload() always renders
1. Component renders with `count: 1`
2. Call `reload()` - `on_load()` sets `count: 1` again (no change)
3. **Expected**: Re-render occurs anyway (reload() always renders)

### Scenario 4: Debounce precedence
1. Call `refresh()` (queues reload(false))
2. Immediately call `reload()` (queues reload(true))
3. **Expected**: reload(true) executes, always re-renders

### Scenario 5: Render count validation
- Each scenario tracks `on_render()` calls to verify renders occurred/skipped

## Key Behaviors

- **refresh()**: Calls `reload(false)`, only renders if data changed
- **reload()**: Calls `reload(true)` (default), always renders
- **State machine**: `next_reload_force_refresh` ensures reload(true) beats reload(false)
- **Snapshot comparison**: Uses `_data_on_last_render` for comparison
- **Early exit**: If no render occurs, skips `_wait_for_children_ready()` and `on_ready()`
