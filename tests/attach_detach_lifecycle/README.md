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
- every jQuery removal path checked at the event level on a tracked component, with the
  order `detach` event, `on_detach()`, `on_stop()`, `stop` event: `.remove()`,
  `.remove(selector)`, `.replaceWith()` on the root, `.replaceAll()`, and ancestor
  `.remove()` / `.empty()` / `.html(x)` / `.text(x)` / `.replaceWith()`
- nested components: an ancestor removal stops parent then child
- a parent `render()` re-render detaches and stops the old child before the new one attaches
- `.component('Name')` on an element already holding a component stops the old one first
- a stopped component reinserted into the document fires nothing and is not re-tracked
- verified on Chromium, Firefox and WebKit in all three cache modes

Run: `./run-test.sh`
