# Ready State After a Partial Render and After a Quiet Refresh

Regression test for the `ready` lifecycle event in `packages/core/src/component.ts`
(`render()`, `_reload()`, `_render()`, `_wait_for_children_ready()`, `ready()`).

The `ready` event is sticky: `ready()` resolves immediately when `_ready_state >= 4`
AND the sticky marker is present. Any cycle that deletes the marker owes the component
a matching `trigger('ready')`, or every later `await comp.ready()` hangs - including the
one a parent performs inside `_wait_for_children_ready()`.

## What This Tests

**A. `render(sid)` leaves the parent ready.**
`render('counter')` delegates to the `$redrawable` child and returns; the child runs its
own invalidate/trigger cycle. `render()` used to invalidate the PARENT's `ready` before
that delegation, so the parent lost its sticky marker with nothing left to re-trigger it
and `await parent.ready()` hung until some unrelated full render.

**B. A `refresh()` that finds unchanged data still fires `ready`.**
`Rs_Poller.on_load()` returns constant data, so `refresh()` takes its no-render path:
no re-render and - as documented - no `on_ready()`. But `_reload()` had already
invalidated `ready` at the top and the load phase had dropped `_ready_state` to 2, and
nothing restored either. The documented polling pattern therefore left the component
permanently not ready after its first quiet refresh. The fix triggers `ready` (without
calling `on_ready()`) and restores `_ready_state = 4`.

**C. Repeated render/ready cycles do not accumulate listeners.**
Twenty `render()` + mid-render `ready()` pairs. `ready()` and
`_wait_for_children_ready()` used `on()`, never `once()`, so every cycle appended a
listener that could never fire again. Pre-fix this assertion reported 21 parent `ready`
callbacks.

**D. A child stopped while the parent waits releases the parent.**
`Rs_Poller.on_load()` is slowed to 300 ms, a `render()` is started, and the freshly
created child is stopped while the parent is parked in `_wait_for_children_ready()`.
A stopped child never fires `ready` again, so the parent's `Promise.all` never settled.
The wait is now raced against the child's `stop` event.

## Running

```bash
JQHTML_BROWSER=chromium ./run-test.sh
JQHTML_TEST_CACHE_MODE=html ./run-test.sh
```

`run-test.sh` exits non-zero if any assertion logs `FAIL:` or if the summary line never
appears. Every wait in the test races an explicit deadline, so a component that never
becomes ready shows up as a failed assertion rather than as a harness timeout.

## Notes for Editing This Test

- The stop in D happens one tick after `render()` starts, not synchronously: the queued
  render executor replaces the children before it waits, so stopping the OUTGOING child
  would prove nothing.
- `Rs_Parent` deliberately has no `on_load()`. Its readiness depends only on its children
  and on its own bookkeeping, which is what the assertions are about.
- `Rs_Poller.on_load()` must keep returning identical data, or `refresh()` stops taking
  the no-render path that group B exists to cover.
