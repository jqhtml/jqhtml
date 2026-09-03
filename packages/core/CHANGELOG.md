# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 2.3.61 (2026-09-03)

### Bug Fixes

* **rendering:** markup written in one component's template and rendered inside another
  (a `<Slot:>` body, or default content between a component's tags) now binds its
  `@`/`on*` handlers, scopes its hand-written `id=`, and sets `instantiator()` of
  components written in it to the DEFINING component, matching `<%= %>` and `$sid`.
  Previously the receiving component was used, so a handler written in A next to
  `$sid` and `this.args` that resolved to A silently ran with `this === B`. The
  compiler now splices content as `['_content', instructions, definer]`; the
  instruction processor renders that block in `definer`, and the per-element
  context it already recorded is honoured when attributes are applied. The
  `_flatten_instructions` step that discarded the context is removed.
* **inheritance:** a slot-only template's slot functions receive every argument
  passed to `content('name', ...)`, not just the first.

## 2.3.54 (2026-08-19)

### Features

- **`on_viewport_resize(viewport_width)` on Component** — a viewport hook that replaces
  per-component `$(window).on('resize')` bindings. The framework installs one window
  `resize` listener, debounced 30ms on the trailing edge, and dispatches to every
  component in the document by walking `$('.Component')` in document order. The hook also
  fires automatically after every `on_render()` and after every `on_ready()`, so a
  component's sizing logic lives in one place instead of being duplicated between
  `on_ready()` and a resize handler.

  The argument is `window.innerWidth` — viewport width in CSS pixels including the
  scrollbar gutter, so it agrees with what CSS media queries resolve against. For the
  component's own width use `this.$.width()`.

  Detached components are not found by the walk and stopped components are explicitly
  skipped, so there is no listener to unbind — this removes the leak the old pattern
  invited, since `on_stop()` is not guaranteed to run when a node is orphaned. A handler
  that throws is logged and the walk continues. Must be synchronous. It is the one `on_*`
  hook not protected from manual invocation, having no lifecycle invariants to violate.

  Base implementation is a no-op stub, so components that don't override it are
  unaffected. New source file: `src/viewport.ts`. Test: `tests/viewport_resize`.

- **`gate_load(promise)` on Component** — register "load gates" during `on_create()`
  that defer a component's **first** `on_load()` until the supplied promises settle
  (awaited together via `Promise.allSettled`). Gates are one-shot (first load only —
  `reload()`/`refresh()` never re-await), rejections are logged and never block the
  load, and gates delay only the load phase (never `create()`, render, `on_render()`,
  or the cached first paint). Calling `gate_load()` after the first load throws.
  While gated, the wait is released by whichever comes first — all gates settling,
  `reload()`, `refresh()`, or `stop()` — and any later settlement is a no-op. A no-op
  during SSR. jqhtml stays agnostic about what is awaited; timeout policy is the
  caller's. See `docs/reference/14_lifecycle_complete_specification.md` (§4a) and the
  `tests/gate_load/` behavioral test.

## 2.2.13 (2025-09-21)

**Note:** Version bump only for package @jqhtml/core





## 2.1.10 (2025-09-18)

**Note:** Version bump only for package @jqhtml/core





## 2.1.9 (2025-09-18)

**Note:** Version bump only for package @jqhtml/core
