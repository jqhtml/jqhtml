# Event Dispatch Snapshot

Regression test for a mutate-during-iterate bug in the component event system.

## The Bug

`event_trigger()` iterated the **live** callback array:

```javascript
const callbacks = component._lifecycle_callbacks.get(event_name);
if (callbacks) {
    for (const callback of callbacks) { ... }
}
```

`event_once()` registers a wrapper that splices **itself** out of that same array
before invoking the user callback. When the wrapper at index `i` removed itself, the
element at `i+1` shifted into slot `i` and the `for...of` iterator advanced past it —
so the next handler in the list was never called for that trigger.

Consequences observed:

- Two pending `.once()` handlers on the same event: only the first fired. The second
  stayed registered but never fired for that occurrence, and because the event is now
  sticky nothing re-triggers it — an `await new Promise(r => comp.once('load', r))`
  hangs forever.
- `.once()` registered before `.on()`: the `.on()` handler was skipped for that
  trigger (it recovered on later triggers).
- N consecutive `.once()` handlers: only every other one fired (`[0, 2, 4]` of five).
- A handler registered **during** dispatch fired twice: once immediately via `.on()`'s
  sticky replay (`trigger()` marks the event as occurred before dispatching), and again
  when the live iterator reached the newly appended slot.

**Real-world discovery:** two independent code paths in an RSpade SPA (a page-title
resolver and a breadcrumb-label resolver) both did
`await new Promise(r => component.once('load', r))` on the same action. One promise
resolved, the other hung, and breadcrumbs rendered as permanent loading placeholders.
Failure was nondeterministic — a `.once()` registered *after* the event fired takes the
sticky immediate-fire path and masks the bug.

## The Fix

`packages/core/src/component-events.ts` — iterate a snapshot:

```javascript
for (const callback of [...callbacks]) { ... }
```

## Expected Behavior

Every handler registered at the moment `trigger()` is called is invoked exactly once
for that trigger, regardless of how many are `once()` wrappers. Handler
self-deregistration during dispatch does not affect delivery to other handlers in the
same dispatch. Handlers registered *during* a dispatch are not part of that dispatch's
snapshot (they still get the sticky immediate-fire from `.on()`).

## Assertions (9)

1. Two pending `.once()` on the same event both fire — `['A', 'B']`
2. `.once()` + `.once()` + `.on()` all fire in registration order — `['A', 'B', 'C']`
3. A second trigger fires only the surviving `.on()` handler — `['C']`
4. `.once()` registered before `.on()` does not skip the `.on()`
5. Five consecutive `.once()` handlers all fire — `[0, 1, 2, 3, 4]`
6. All five `.once()` handlers deregister after firing
7. `.once()` still fires exactly once across three triggers
8. A handler registered during dispatch fires once (sticky), not twice
9. Two independent `await once('ready')` promises on one component both resolve
   (3s timeout guard — this is the hang from the field report)

## Related Files

- `packages/core/src/component-events.ts` — `event_on()`, `event_once()`, `event_trigger()`
- `packages/core/src/component.ts` — `on()`, `once()`, `trigger()` public API
- `tests/loaded_event_and_once/` — broader `.once()` semantics (sticky, chaining, reload)
