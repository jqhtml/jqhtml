# html_cache_child_unchanged_load

**Mode:** `['html']` only (the other two modes instant-pass)

## Validates

A dynamic `Hcu_Parent` makes html mode wait, in its ready phase, for every child's DOM to
be final before it snapshots. `Hcu_Child` has an `on_load()` that assigns exactly its
`on_create()` defaults, so its load leaves the data unchanged and it never re-renders.

**A. First boot (cache miss).** The parent reaches `ready()` within 1 s; the child is live,
in `_ready_state` 4, rendered exactly once and marked render-complete; the parent's
snapshot contains the child's final DOM (its `on_render()` attribute and label).

**B. Cache-hit boot.** A `$seed=true` parent (same `cache_id()`, template-only child)
writes the snapshot first, so this part does not depend on A. A new `Hcu_Parent` then
injects that snapshot (asserted), loads, re-renders, boots a fresh `Hcu_Child` whose load
again leaves the data unchanged, and must reach `ready()` within 1 s. The re-written
snapshot must hold that child's final DOM and none of the seed's markup.

Every wait races a 1 s timeout, so a hang is reported as a FAIL rather than a stalled run.

## Before the fix

`_on_render_complete` was set only by a render at `_ready_state >= 2` (a post-load
re-render) or by the first render of a component with no `on_load()`. A child whose load
left the data unchanged did neither, so `_wait_for_children_on_render()` never resolved:
both "reached ready() within 1s" assertions fail with `timeout`.

## Related source

- `packages/core/src/lifecycle-manager.ts` - boot marks `_on_render_complete` at the end of the render chain, before `rendered`
- `packages/core/src/component.ts` - `_wait_for_children_on_render()` also wakes on `rendered`
- `tests/html_cache_children_without_on_load` - the template-only-child variant
