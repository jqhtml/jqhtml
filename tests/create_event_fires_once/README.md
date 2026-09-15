# create Event Fires Once

## What this demonstrates

The `create` lifecycle event fires **exactly once** per component, for every kind of
subscriber:

- `.on('create', …)` registered from inside the component's own `on_create()`
- `.once('create', …)` registered from inside `on_create()`
- `.on('create', …)` / `.once('create', …)` attached right after `$el.component(Name, args)`
  returns (sticky replay)
- `.on('create', …)` / `.once('create', …)` attached long after `ready()` (sticky replay),
  which must not re-fire the earlier subscribers

## The bug (audit bug 18)

`component.create()` ends with `this.trigger('create')`, and `LifecycleManager.boot_component()`
called `component.trigger('create')` again immediately after `create()` returned. Every
`.on('create')` subscriber therefore saw the event twice.

The duplicate could not be observed from outside: by the time `$el.component(…)` returns,
`_boot()` has already run synchronously up to the first real `await`, so both triggers
have happened and a listener attached at that point only sees the sticky replay (one call).
`Ce_Probe` therefore subscribes from inside its own `on_create()` — the one vantage point
early enough to count the triggers themselves. That assertion reports `2` before the fix
and `1` after it.

`once()` was never affected: the first trigger deregisters the wrapper.

## Fix

`packages/core/src/lifecycle-manager.ts` no longer triggers `create`. `create()` is
idempotent (`if (this._stopped || this._ready_state >= 1) return;`), so it is the single
owner of the event.

## Files

- `test.jqhtml` / `test.js` — the harness component and assertions
- `ce_probe.jqhtml` / `ce_probe.js` — a minimal component that counts its own `create` event

## Related source

- `packages/core/src/component.ts` — `create()` and its `trigger('create')`
- `packages/core/src/lifecycle-manager.ts` — `boot_component()`
- `packages/core/src/component-events.ts` — sticky replay semantics for `on()` / `once()`
