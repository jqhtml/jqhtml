# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## Unreleased

### Features

- **`gate_load(promise)` on Component** — register "load gates" during `on_create()`
  that defer a component's **first** `on_load()` until the supplied promises settle
  (awaited together via `Promise.allSettled`). Gates are one-shot (first load only —
  `reload()`/`refresh()` never re-await), rejections are logged and never block the
  load, and gates delay only the load phase (never `create()`, render, `on_render()`,
  or the cached first paint). Calling `gate_load()` after the first load throws.
  While gated, the wait is released by whichever comes first — all gates settling,
  `reload()`, `refresh()`, or `stop()` — and any later settlement is a no-op. A no-op
  during SSR. jqhtml stays agnostic about what is awaited; timeout policy is the
  caller's. See `docs/official/14_lifecycle_complete_specification.md` (§4a) and the
  `tests/gate_load/` behavioral test.

## 2.2.13 (2025-09-21)

**Note:** Version bump only for package @jqhtml/core





## 2.1.10 (2025-09-18)

**Note:** Version bump only for package @jqhtml/core





## 2.1.9 (2025-09-18)

**Note:** Version bump only for package @jqhtml/core
