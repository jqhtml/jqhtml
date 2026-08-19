# Cache Key Content Serialization

End-to-end test for content-based cache keys, through the real component pipeline.

Full specification: `docs/official/15_deduplication_and_caching.md`.
Exhaustive decline matrix: `packages/core/test/cache-key-serialization.test.js` (31 assertions).

## The problem

A component's cache key is its name plus its args. Object args used to produce **no key at
all**, which silently disabled caching for the receiving component. Templates rebuild
`{parent_type: 'Contact_Model', parent_id: 12}` on every render, so identity could never
match — and a downstream app lost instant SPA revisits across every list screen because a
datagrid wrapper passed a scoping-params object to the child that fetched rows. Nothing
errored; the app just refetched forever.

## What changed

Plain data is keyed by deterministic **content**: object keys sorted recursively, array order
preserved, each value's shape encoded so `{a: 1}`, `[1]` and `"1"` cannot collide.

Anything that cannot be expressed exactly **declines** with a reason. That is the whole
safety argument — a serializer that dropped a function (as `JSON.stringify` silently does)
would make two args differing only by a callback produce the same key, and a component would
render another component's cached content. A false cache hit is worse than no cache.

## What this test asserts (9)

1. A plain-data object arg has no `data-nocache` and gets a real cache key.
2. Two separately-constructed equal objects share one cache key.
3. A different value produces a different key.
4. An arg containing a function still declines, with `data-nocache="params:function"`.
5. Both components still load and render.

## Deduplication is deliberately excluded

Content keys apply to the **cache only**. Deduplication still requires primitive args or an
author-supplied id, because a deduplicated follower never runs `on_load()` and adopts the
leader's data with no revalidation — a wrong key there is permanently wrong data, while a
wrong cache key is corrected on the next revalidation. Redundant concurrent requests are the
cheaper failure. `_load()` computes the two identities separately for exactly this reason.
