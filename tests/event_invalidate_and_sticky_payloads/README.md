# invalidate() and Sticky Event Payloads

Every event is sticky: `trigger(name, data)` stores the event and its payload, and a
`.on()`/`.once()` registered later fires at once with that payload. `invalidate(name)` drops
the stored marker. Contract: `docs/reference/14_lifecycle_complete_specification.md`
("trigger", "invalidate(event_name)"). `event_data_parameter` and `event_system_edge_cases`
cover the basic replay; this test covers the rest.

## What it validates (17 assertions)

A. Payloads: a falsy payload (`0`, `false`, `null`, `''`) is replayed unchanged to `.on()`
   and `.once()`; a later trigger without a payload replaces the stored one; a handler
   registered during dispatch receives the payload being dispatched, once.

B. `invalidate()` on a custom event: a new `.on()`/`.once()` does not fire immediately;
   the next trigger fires the existing handler and the late ones with the new payload; a
   late `.once()` fires once; the event is sticky again afterwards; other events stay
   sticky; invalidating an event that never fired is a no-op.

C. `invalidate('ready')` on a ready component: `ready()`, its callback and `.on('ready')`
   wait for the next `trigger('ready')`, then `ready()` resolves immediately again.

D. `render()` invalidates `'ready'`: a `.on('ready')` registered right after `render()`
   fires when the render completes, not before.

With `event_invalidate()` made a no-op, B, C and D fail (5 assertions); with falsy stored
payloads dropped, the four falsy-payload assertions in A fail.
