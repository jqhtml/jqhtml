# html_cache_replay_ids_and_stop

**Mode:** `['html']` only (the other two modes instant-pass)

## Validates

**A. Replaying one snapshot into two instances does not duplicate scoped ids.**
An HTML-cache entry is `{cid, html}` - the inner markup plus the cid it was rendered
under. Every scoped id inside reads `<name>:<cid>`, so on injection the runtime maps the
snapshot owner's cid to the injecting component's `_cid` and every other cid (its
children's) to a fresh `uid()`. The test warms the cache with one `<Hc_Card $id=1>`,
leaves it live in the document, then creates two more in one container so both hydrate
from the same entry, and asserts - inside each card's cached `on_render()` and again
after `ready()` - that `$sid('name')` resolves inside that card, that the card's scoped
id is unique in the document, and that the two cards' name elements are different nodes.

**B. A cache-mode reload stops the children it overwrites.**
`Hc_Card.cache_id()` ignores `args.variant`, so setting `variant` makes `reload()` see
changed args (which is what makes it consult the cache) while the key stays the same -
the only way to reach `check_cache_on_reload()`'s injecting branch. `on_load()` ignores
`variant` too, so the data comes back unchanged: the injected snapshot is re-rendered
because it is inert markup, not because the data differs. The test asserts the
previous `Hc_Child`'s `on_stop()` fired exactly once, that the child is marked stopped,
that no stale entry survived in `_dom_children`, and that `_dom_children` matches the
live children once the re-render has run.

## Before the fix

The `_cached_html` branch of `_render()` returned before the stop-children/clear-DOM
block, so a cache-mode reload injected over a live subtree without stopping anything
(`on_stop()` never ran, `_dom_children` kept dead entries), and the snapshot was a bare
string injected verbatim, so two live instances shared ids and `$sid()` - which is
`getElementById()` first - could hand one instance the other's element. 10 of the 23
assertions fail against that code.

## Related source

- `packages/core/src/component.ts` - `_render()` shared prologue, `_rescope_cached_html()`, `$sid()`
- `packages/core/src/component-cache.ts` - `write_html_cache_snapshot()`, `read_cache_in_create()`, `check_cache_on_reload()`
- `packages/core/src/instruction-processor.ts` - `uid()`, scoped-id emission
- `docs/internal/audit_core_2026-09-14.md` - bugs 6 and 7; also items 25 and 26, which
  the fixture no longer has to work around (`Hc_Child` is template-only, and `Hc_Card`'s
  data does not depend on `variant`)
