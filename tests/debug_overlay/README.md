# Component Debug Overlay

Exercises `jqhtml.debug_overlay` in real Chrome: enable/disable, hover outlines and
labels across the component chain, the click-to-inspect modal, Alt+click pass-through,
`inspect()`, coverage of components created after enable, and that disable leaves
nothing behind but the inert stylesheets.

The stylesheet convention that keeps the overlay off the application's toes is tested
separately in `packages/core/test/debug-overlay-audit.test.js` and enforced by the core
build. Development notes: `packages/core/src/debug-overlay/CLAUDE.md`.
