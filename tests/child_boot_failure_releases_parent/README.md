# A Failing Child Boot Releases Its Parent

Regression test for the boot failure path (`packages/core/src/lifecycle-manager.ts`
`boot_component`) and for the stopped-state bookkeeping in
`packages/core/src/component.ts` (`_stop()`, `render()`, `load()`, `_reload()`).

A hook that throws during boot leaves a component that will never reach `ready`.
Something has to tell the rest of the framework about it, or an ancestor parked in
`_wait_for_children_ready()` waits on a `ready` event that can never fire.

## What This Tests

**A. A child whose `on_load()` rejects does not wedge its parent.**
`Bf_Parent` renders a healthy `Bf_Good` and a `Bf_Bad` whose `on_load()` throws.
`boot_component` used to log and RETHROW, so nothing stopped `Bf_Bad`: the parent
never reached `on_ready()` and `await parent.ready()` hung forever. The boot failure
now stops the component - `_Component_Stopped`, the `stop` event, and removal from
the parent's `_dom_children` - and the `stop` event is what releases the parent.

**B. A failing boot is not an unhandled rejection.**
`_boot()` is called unawaited with no `catch` by `instruction-processor`'s
`initialize_component()` and by the jQuery plugin's setter, so the rethrow surfaced
as `unhandledrejection` for any `$(el).component()`-created component whose hook
threw. The error is reported through `handleComponentError()` (so `breakOnError`
still works and the error object is still a `console.error` argument that tests can
grep) and goes no further.

**C. A component stopped mid-reload runs no more hooks.**
`render()`, `load()` and `_reload()` checked `_stopped` only on entry, so after their
awaits they ran `on_loaded()` / `on_ready()` and fired `loaded` / `ready` on a
detached, already-stopped component. `Bf_Slow.on_load()` takes 200 ms; the test calls
`reload()` without awaiting it and stops the component 50 ms in. Neither hook may run.

**D. A plain child is fully stopped.**
`_stop()` had a fast path for a component with no custom `on_stop()` and no `stop`
listeners that skipped both the `_Component_Stopped` class and the de-registration
from `_dom_parent._dom_children`, leaking dead children into the parent's registry.
The fast path is gone; `on_stop()` is still only invoked when overridden.

Note the two halves of D. A child a parent is waiting on carries a `stop` listener
from `_wait_for_children_ready()`, which by itself was enough to keep `_stop()` off
the fast path - so the second half stops a component nobody is waiting on, which is
the case the fast path really covered.

**E. The `create` event count is recorded, not asserted.**
`create` is triggered from two places (`component.ts` and `lifecycle-manager.ts`).
The count is printed for a later step to assert; this test only records it.

## Running

```bash
JQHTML_BROWSER=chromium ./run-test.sh
JQHTML_TEST_CACHE_MODE=html ./run-test.sh
```

`run-test.sh` exits non-zero if any assertion logs `FAIL:` or if the summary line never
appears. Every wait races an explicit deadline, so a component that never becomes ready
shows up as a failed assertion rather than as a harness timeout.

## Notes for Editing This Test

- `Bf_Bad` is expected to print a `[JQHTML Error] ... failed in boot:` line and a
  load-coordinator error line. Those are the test working, not noise to silence.
- The `reload()` in C must NOT be awaited: the whole point is to stop the component
  while that call is parked inside `on_load()`.
- The lone component in D is created as `$('<div>').appendTo(stage).component(...)`,
  in that order. A component constructed off-DOM finds no `_dom_parent`, which would
  make the de-registration assertion vacuous.
