# skip_cache_read

A component carrying `skip_cache_read` (and every component created inside it) never
reads the component cache - no data hydration, no cached-HTML first paint - but writes it
exactly as usual.

Each visit loads a new value (`<tag>_<version>`), so the test can tell what a component
first painted (`init` = its `on_create()` data, i.e. no cache read) and what the cache holds
afterwards.

- **A/B** - warm the cache, then boot with `skip_cache_read`: the page, its child, its
  grandchild and a component created by the page's re-render after load all paint `init`.
- **C** - `$(el).component()` on an element inside the skipping subtree inherits it.
- **D** - an ordinary boot afterwards paints the skipping boot's values: the writes happened,
  under the ordinary key (data snapshot in `data` mode, html snapshot in `html` mode).
- **E** - the template spelling `$skip_cache_read=true`.
- **F** - not in `this.args`; cache key and dedup key identical with and without it.
- **G** - `was_ready_before()` reads and writes its marker as usual.
- **H** - without the argument, a component booted inside a `display:none` container skips
  the read too, and still writes.
- **I** - a `reload()` with changed args while hidden does not render from cache.

In `none` mode every first paint is `init`; the assertions account for it.

Source: `packages/core/src/component.ts` (constructor, `_find_dom_parent()`),
`packages/core/src/component-cache.ts` (`read_cache_in_create()`, `check_cache_on_reload()`).
