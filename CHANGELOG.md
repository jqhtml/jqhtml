# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 2.3.61 (2026-09-03)

### Changed

- Handler attributes (`@click`, `on*`), hand-written `id=` scoping and `instantiator()` in
  slot bodies and default content now bind to the component whose template wrote the markup,
  matching `<%= %>` and `$sid`. A handler that previously ran with `this` set to the receiving
  component now runs against the defining one. See packages/core/CHANGELOG.md.

### Added

- `<Slot:name $params="a, b">` names the values a slot receives from `content('name', a, b)`.
  See packages/parser/CHANGELOG.md.

## 2.3.54 (2026-08-19)

### Added

- Runtime configuration for host integrations: `jqhtml.init($, config)` and
  `jqhtml.configure(config)`. `mode: 'development' | 'production'` describes the environment
  the application is running in, and jqhtml derives behaviour from it; individual flags can
  override a mode's defaults. Mode defaults to `'development'`, so an integration that passes
  nothing behaves exactly as before and production is opt-in. Read the resolved settings with
  `jqhtml.get_config()`. Two conventions ship with it:
  - `warn_uncacheable_args` (dev) — warns once per component+arg when a component with a
    custom `on_load()` is invoked with a non-serializable arg AND defines no `cache_id()`.
    Such a component still works, but silently opts out of cache reuse and load
    deduplication. The warning names the arg, says what was lost, recommends `cache_id()`,
    and gives a `[data-nocache]` selector for finding it in DevTools.
  - `debug_attributes` (off in prod) — suppresses `data-sid` and `data-cid`, both of which
    are debug-only mirrors: of the scoped `id="<sid>:<cid>"` that `$sid()` actually resolves
    against, and of the component's `_cid`. The runtime reads neither, so `$sid()`, `sid()`,
    scoping, `reload()` and `render()` are all unaffected. The separate TRANSIENT `data-cid`
    the instruction processor uses to correlate freshly-injected HTML with component data is
    functional and is never suppressed. Docs:
    `docs/reference/20_runtime_configuration.md`. Test: `tests/integration_config_modes`
    (34 assertions).

- `on_viewport_resize(viewport_width)` — a viewport hook on `Jqhtml_Component`. The
  framework installs one window `resize` listener, debounced 30ms, and dispatches to every
  component in the document; the hook also fires after every `on_render()` and every
  `on_ready()`. The argument is `window.innerWidth` in CSS pixels, matching what CSS media
  queries resolve against. Detached and stopped components are skipped and a handler that
  throws does not stop the fan-out, so components no longer bind (or leak) their own
  window listener — the previously documented "bind in `on_ready()`, unbind in
  `on_stop()`" pattern could strand a listener, because `on_stop()` is not guaranteed to
  run when a node is orphaned. Base implementation is a no-op. Test:
  `tests/viewport_resize`.

### Changed

- Cache keys now accept plain-data object and array args by deterministic CONTENT instead of
  declaring them uncacheable. Templates rebuild `{parent_id: 12}` on every render, so
  identity-based keying could never match and permanently opted the receiving component out of
  caching — a silent loss of instant SPA revisits. The keyable set is deliberately narrow
  (null, undefined, boolean, number, string, `Date`, arrays, and plain objects, nested freely);
  keys are sorted recursively, array order is preserved, and each value's shape is encoded so
  `{a:1}`, `[1]` and `"1"` cannot collide. Everything else DECLINES with a reason rather than
  being approximated — a serializer that dropped a function, as `JSON.stringify` does, would
  let two args differing only by a callback share a key and serve the wrong cached content.
  `._jqhtml_cache_id` / `jqhtml_cache_id()` still take precedence. New module:
  `packages/core/src/cache-key-serializer.ts`.
- **Deduplication deliberately does NOT use content keys** and still requires primitive args or
  an author-supplied id. A deduplicated follower never runs `on_load()` and adopts the leader's
  data with no revalidation, so a wrong key there is permanently wrong data, whereas a wrong
  cache key is corrected on revalidation. `_load()` now computes the cache identity and the
  dedup identity separately.
- `data-nocache` now carries the reason as `"<arg>:<reason>"` (e.g. `"on_select:function"`,
  `"rows:circular"`, `"model:non-plain-object"`), and the development warning explains which
  kind of value blocked keying.
- The persisted cache scope is now versioned by the core version, so a release that changes key
  shape invalidates everything stored under the old shape. Existing `_validate_scope()` clearing
  does the work; no new invalidation path.

### Fixed

- Deduplication could pair unrelated components under a `null` key. `should_execute_on_load()`
  and `register_leader()` used the key without checking for null, and `Map` accepts `null` as a
  key, so any two components that both failed to produce a key shared one coordination entry —
  a follower could adopt an unrelated component's data. Reachable whenever a component defined
  `cache_id()` (making its cache key non-null, so the early return no longer applied) while its
  args stayed un-keyable. Both call sites now treat a null key as "no coordination".

- `trigger()` no longer skips handlers when a `.once()` handler deregisters itself
  mid-dispatch. `event_trigger()` iterated the live callback array while `.once()`
  wrappers spliced themselves out of it, so removing the handler at index `i` shifted the
  next handler into an already-visited slot and the iterator advanced past it. With two
  pending `.once()` handlers on the same event only the first fired — and since the event
  is sticky from that point on, the second never fired at all, hanging any
  `await new Promise(r => comp.once(evt, r))` forever. N consecutive `.once()` handlers
  fired every other one; a `.once()` registered before an `.on()` skipped the `.on()` for
  that trigger. `trigger()` now dispatches to a snapshot of the handlers registered when
  it was called, which also stops a handler registered *during* dispatch from firing
  twice (once via `.on()`'s sticky replay, again when the live iterator reached it).
  Regression test: `tests/event_dispatch_snapshot`.

## 2.3.51 (2026-07-23)

### Fixed

- `<br>` no longer renders doubled. The compiler emitted a stray closing-tag string
  after every HTML5 void element (`</br>`, `</hr>`, …); browsers parse a stray `</br>`
  as a second `<br>` element, so every template `<br>` produced a double line break.
  Closing tags are no longer emitted for the void element set (`area base br col embed
  hr img input link meta source track wbr`). Regression test:
  `tests/void_element_single_render`.

## 2.3.50 (2026-07-21)

First public release on GitHub ([github.com/jqhtml/jqhtml](https://github.com/jqhtml/jqhtml)).
Versions 2.3.36–2.3.49 were internal-only; this entry summarizes everything shipped
since 2.3.35, the previous public npm release.

### Added

- `gate_load(promise)` — register promises in `on_create()` that delay the component's
  first `on_load()` (initial render is not delayed); released by gates settling,
  `reload()`, `refresh()`, or `stop()`
- `on_loaded()` lifecycle hook — runs after `on_load()` on the real component
  (`this.data` frozen, `this.$`/`this.state` accessible); introduced as `after_load()`
  and renamed
- `.once(event, callback)` — fire-exactly-once event listener with sticky-event support
- `'loaded'` and `'rendered'` lifecycle events; `rendered(callback?)` method resolving
  when the render chain completes, before the ready phase
- `<%br= %>` interpolation — escaped output with newline-to-`<br />` conversion
- SSR preload API (`jqhtml.start_data_capture()`, `get_captured_data()`,
  `set_preload_data()`, `clear_preload_data()`) — capture data server-side, replay on
  the client so hydration skips `on_load()`
- `render_spa` request type in `@jqhtml/ssr` — full-page SPA rendering through the
  app router in jsdom
- `_load_only` / `_load_render_only` lifecycle truncation flags with parent→child
  cascade, plus detached-boot optimization
- `//` whole-line comments inside `<% %>` code blocks
- Guards against hand-authored `data-sid`: creating it via jQuery HTML injection, or
  using `[data-sid...]` selectors in `.find()`/delegated `.on()`, now throws with
  guidance to use `$sid()`/`sid()`

### Changed

- `jqhtml.register(Class)` uses the class name by default; `static component_name` is
  only needed to survive minification
- `trigger('on_loaded')` renamed to `trigger('loaded')`
- `<% %>` code blocks are rejected inside attribute values at compile time (use
  `<%= expr %>` interpolation within quoted attribute values instead)
- CSS animations/transitions are automatically suppressed for one frame during the
  initial-boot double-render to prevent visual artifacts

### Fixed

- `render()` / `redraw()` now return the lifecycle promise — `await this.render()`
  resolves after DOM update, children ready, and `on_ready()`, as documented
- `stop()` now fires the `'stop'` event for registered listeners even when the
  component defines no `on_stop()`
- Template-authored `$_load_only=false` / `$_load_render_only=false` now correctly
  opt a child out of a cascading parent flag
- Cache serializer no longer drops shared (non-circular) references — the same object
  under two `this.data` keys survives a cache round-trip (as independent copies)

## 2.2.13 (2025-09-21)

**Note:** Version bump only for package @jqhtml/monorepo
