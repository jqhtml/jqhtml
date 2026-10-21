# Load Coordinator: Leader Fails After on_load() Returns

Regression test for the deduplication coordinator when the leader's failure happens in
the apply step (`packages/core/src/component.ts` `_load()` / `_apply_load_result()`),
not in `on_load()` itself.

## What This Tests

**A. A leader whose `on_loaded()` throws.** Three `<Apply_Fail_Card $key="a">` boot
together; the leader's `on_load()` succeeds, then its `on_loaded()` throws. All three must
settle (fail in boot) within one second, exactly as when the leader's `on_load()` throws
(see `coordinator_error_and_cleanup`). Previously `complete_coordination()` was skipped
and the entry stayed `'loading'`, so the followers and every later same-args component
hung forever.

**B. A leader whose `on_load()` sets `this.data = null`.** Same shape. `_apply_load_result()`
now rejects a non-object result with an error naming it, before anything is unfrozen,
so the leader's `this.data` stays frozen and the entry is released the same way.

In both cases the registry is empty afterwards, and a later card with the same args
becomes a new leader, runs `on_load()` itself and reaches `ready` with real data. Every
wait races an explicit deadline, so a hang is a failed assertion.

## Running

```bash
JQHTML_BROWSER=chromium ./run-test.sh
JQHTML_TEST_CACHE_MODE=html ./run-test.sh
```
