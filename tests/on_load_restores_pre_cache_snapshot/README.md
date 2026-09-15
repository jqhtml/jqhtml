# on_load_restores_pre_cache_snapshot

Two lifecycle guarantees that a cache must not be able to bend.

## A. The snapshot is the on_create() state, warm cache or not (`data` mode only)

CLAUDE.md: "Before on_load(): `this.data` is RESTORED to on_create() snapshot".
`create()` used to take that snapshot AFTER `read_cache_in_create()`, which
REPLACES `this.data` on a warm `data`-mode cache. On a warm boot `on_load()`
therefore restarted from cached data instead of from `on_create()`.

`Snap_List` makes that visible: `on_create()` sets `items = []`, `on_load()`
appends one row. Boot one instance (cold, writes the cache), then boot a second
with the same args. Correct: one row. Pre-fix: two.

Guarded by `VALID_MODES = ['data']` - there is no `this.data` cache to hydrate
from in `none` or `html` mode, so group A logs a SKIP there. Group B below is
mode-independent and always runs.

## B. load() on a component with no on_load() runs nothing (all modes)

`load()` had no `__has_custom_on_load` guard. A template-only component has no
`__initial_data_snapshot` (create() skips it), so the detached execution produced
`{}` and assigned it straight over `this.data`, wiping the `on_create()` defaults
of a component that defines no data fetching at all.

`Snap_Plain` sets `this.data.label = 'x'` in `on_create()` and overrides nothing
else. `await plain.load()` must return `false` and leave `label === 'x'`.

## Source

- `packages/core/src/component.ts` - `create()`, `load()`
- `docs/internal/audit_core_2026-09-14.md` - bugs 3 and 17
