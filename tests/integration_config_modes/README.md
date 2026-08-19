# Integration Config Modes

Behavioural test for `jqhtml.configure()` / `jqhtml.init($, config)` — the integration-level
settings a host application supplies to describe its environment.

Full specification: `docs/official/20_runtime_configuration.md`.

## What it validates (27 assertions)

1. **Defaults** — mode is `development`; both flags default on, so an integration passing no
   config keeps every diagnostic.
2. **`debug_attributes` in development** — `data-sid` present on plain elements, component
   elements and nested elements, alongside the scoped `id`.
3. **`warn_uncacheable_args`** — a component with a non-serializable arg and no `cache_id()`
   warns, and the warning names the arg, explains that cache reuse and load deduplication
   are lost, recommends `cache_id()`, and supplies a `[data-nocache]` DevTools locator.
4. **Deduplication** — repeat instances of the same component do not re-warn.
5. **`cache_id()` suppresses it** — the same object arg with an explicit `cache_id()` is
   never warned about.
6. **Production suppresses both** — no `data-sid` anywhere, no warning. Critically, the
   scoped `id` is still emitted and `$sid()` still resolves, proving the attribute was only
   ever a debug mirror.
7. **Flags override mode independently** — an explicit flag beats the mode default; a
   flag-only call leaves the mode alone.
8. **Unknown mode throws** rather than silently doing nothing.

## Key insight

`data-sid` is a debug mirror of the scoped `id="<sid>:<cid>"`. `$sid()` resolves through
`document.getElementById` on the scoped id and never reads `data-sid`, which is why
suppressing it in production changes nothing functional. Assertion 6 exists to keep that
true — if someone ever makes the runtime depend on `data-sid`, this test fails.

`data-cid` on a rendered component is the same kind of debug mirror and is suppressed with it.
The runtime's real use of `data-cid` is a TRANSIENT placeholder written during HTML generation
and removed as soon as the node is matched to its component data — a different id from `_cid`,
alive for microseconds. Assertion set 6 covers this: it proves nested children still boot, and
that `reload()`/`render()` work, with no `data-cid` in the DOM.
