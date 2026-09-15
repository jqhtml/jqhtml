# html_cache_children_without_on_load

**Mode:** `['html']` only (the other two modes instant-pass)

## Validates

**A. A parent whose child has no `on_load()` still reaches `ready()`.** `Hcw_Parent` is
dynamic, so html mode makes its ready phase wait for every child's post-load render before
snapshotting. `Hcw_Leaf` is template-only: it has no load phase at all, so that render
never comes. The test asserts the parent reaches `ready()` within 1 s, that the child is
live and render-complete, and that the parent got as far as writing its html snapshot.

**B. A cache-injecting `reload()` whose data comes back unchanged re-renders anyway.**
`Hcw_Card.cache_id()` and `on_load()` both ignore `args.variant`, so setting `variant`
makes `reload()` see changed args (which is what makes it consult the cache and inject the
snapshot) while the key and the freshly loaded data both stay the same. The test asserts
that after the reload the card has a live child component in `_ready_state` 4, that
`_dom_children` matches, and that no `_Component_Stopped` markup is left behind.

## Before the fix

A: `_wait_for_children_on_render()` polled `_on_render_complete`, which was set only once
`_ready_state >= 2`; a child with no `on_load()` never gets there, so the parent's wait
never returned - no snapshot, no `on_ready()`, no `ready` event. The run hangs and never
prints a summary.

B: `_reload()` decided the post-load render from `data_changed` alone and ignored
`_used_cached_html`, so the injected snapshot - inert markup whose children were stopped
by the injection - stayed on screen with no live components under it.

## Related source

- `packages/core/src/component.ts` - `_wait_for_children_on_render()`, `_render()`'s render-complete marking, `_reload()`
- `packages/core/src/component-cache.ts` - `check_cache_on_reload()`, `write_html_cache_snapshot()`
- `docs/internal/audit_core_2026-09-14.md` - items 25 and 26
