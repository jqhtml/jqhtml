# stop() and on_stop() Test

Validates `stop()` synchronous cleanup and `on_stop()` lifecycle hook.

## What This Tests

1. **`stop()` is synchronous** - `on_stop()` runs inside the `stop()` call and `stop()` returns
   no promise. Checked by call order, not elapsed time, so it holds under any system load
2. **`on_stop()` called during `stop()`** - Lifecycle hook fires
3. **Cleanup of intervals/timers** - `on_stop()` can clear intervals
4. **`stop()` does NOT remove DOM** - Component remains in DOM after stop()
5. **`_Component_Stopped` class added** - Framework marks stopped components

## Expected Output

```
Interval started
Interval running
Interval running
Interval running
Interval running

========================================
CALLING stop():
========================================

Interval cleared in on_stop()
stop() completed
stop() returned: undefined

Component still in DOM: true

Has _Component_Stopped class: true

========================================
VALIDATION:
========================================

✅ TEST 1 PASS: on_stop() was called
✅ TEST 2 PASS: Interval cleared in on_stop()
✅ TEST 3 PASS: Component still in DOM after stop()
✅ TEST 4 PASS: stop() is synchronous (on_stop() ran inside the call; no promise returned)
✅ TEST 5 PASS: _Component_Stopped class added

✅ ALL TESTS PASSED
```

## Key Behaviors

- `stop()` is synchronous (not async)
- `on_stop()` provides cleanup hook for intervals, event handlers, etc.
- Component remains in DOM - caller must remove if desired
- `_Component_Stopped` class marks component as stopped
