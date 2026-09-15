# queue_collapse_and_ordering

**Modes:** all three (`none`, `data`, `html`) - the lifecycle queue is cache-agnostic.

## What this demonstrates

`Component_Queue` serializes `render()` / `load()` / `reload()` / `refresh()` per component.
This test pins down what a caller gets back and when.

1. **Same-type collapse returns the right value.** Three `load()` calls fired synchronously
   run `on_load()` twice (the one already running plus one collapsed run) and **all three**
   promises resolve `true`. The pending executor is replaced by the newest call, and every
   collapsed caller is settled with the value of the run that actually happened.
2. **A different type does not evict a pending one.** `load()` then `render()` both run, in
   call order - including when both are queued behind a running `reload()`. The DOM ends up
   showing the loaded data.
3. **A caller settles before the next queued operation starts.** The first `reload()`'s
   promise resolves before the second queued `reload()`'s `on_load()` begins.
4. **A throwing executor rejects only its own callers.** The queue continues with the next
   entry.
5. **Regression: `reload()` precedence survives the collapse.** A `refresh()` queued behind
   a `reload()` still renders, because both share the `'reload'` queue type and
   `next_reload_force_refresh` keeps the force-render. A lone `refresh()` with unchanged data
   still renders nothing. See also `tests/reload_debouncing/`.

32 assertions. Every wait is raced against a timeout, because the failure mode of a queue
bug is a promise that never settles.

## Why it exists

Before the fix (`docs/internal/audit_core_2026-09-14.md`, bug 11 and the `component-queue.ts`
LOW finding):

- the same-type collapse kept the OLDER executor and each `load()` call read its own closure
  variable, so a collapsed caller reported `false` for a load it never got;
- a different-type entry REPLACED the pending one, so a `render()` landing on a pending
  `load()` dropped the load while resolving its caller as though it had run;
- the pending entry ran inside the current entry's awaited chain, so the first caller's
  promise resolved only after the next queued operation had finished.

## Related source

- `packages/core/src/component-queue.ts`
- `packages/core/src/component.ts` - `render()`, `load()`, `reload()`, `refresh()`, `_reload()`
- `docs/reference/14_lifecycle_complete_specification.md` - `load()` section
