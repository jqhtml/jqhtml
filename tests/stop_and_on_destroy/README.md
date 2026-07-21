# stop() and on_destroy() Test

Validates `stop()` synchronous cleanup and `on_destroy()` lifecycle hook.

## What This Tests

1. **`stop()` is synchronous** - Executes in < 5ms (no await needed)
2. **`on_destroy()` called during `stop()`** - Lifecycle hook fires
3. **Cleanup of intervals/timers** - `on_destroy()` can clear intervals
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

Interval cleared in on_destroy()
stop() completed
stop() execution time: 0ms (should be < 5ms - synchronous)

Component still in DOM: true

Has _Component_Stopped class: true

========================================
VALIDATION:
========================================

✅ TEST 1 PASS: on_destroy() was called
✅ TEST 2 PASS: Interval cleared in on_destroy()
✅ TEST 3 PASS: Component still in DOM after stop()
✅ TEST 4 PASS: stop() is synchronous (0ms)
✅ TEST 5 PASS: _Component_Stopped class added

✅ ALL TESTS PASSED
```

## Key Behaviors

- `stop()` is synchronous (not async)
- `on_destroy()` provides cleanup hook for intervals, event handlers, etc.
- Component remains in DOM - caller must remove if desired
- `_Component_Stopped` class marks component as stopped
