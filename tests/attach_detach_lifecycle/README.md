# Attach / Detach Lifecycle and stop() Reliability

Demonstrates the DOM attachment state machine (`attach` / `detach` events,
`on_attach()` / `on_detach()` hooks, `is_attached()`) and the `jQuery.cleanData`
hook that makes `stop()` fire for every jQuery-driven removal.

Covers:

- `attach` fires after `on_ready()` and the `ready` handlers, is sticky for late subscribers
- `.detach()` fires `detach` (not `stop`); reinserting fires `attach` again, once each
- a synchronous move inside the document (`appendTo`) produces no transition
- `stop()` on an attached component fires `detach` before `on_stop()`
- `.remove()`, `.replaceWith()`, `.empty()`, `.html(x)`, `.text(x)` stop components, descendants included
- native removal (`el.remove()`) does NOT stop; a late `.on('detach')` still sees the state
- a component born off-document attaches only when inserted
- the document observer is installed only while something is tracked, and released after

Run: `./run-test.sh`
