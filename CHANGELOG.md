# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## Unreleased

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
