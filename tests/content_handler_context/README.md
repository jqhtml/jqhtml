# Handler Context in Caller-Written Content

Markup written in component A's template and handed to component B — a `<Slot:x>` body or
the default content between `<B>...</B>` — is compiled as a closure over A. `<%= %>`,
template locals and `$sid` therefore already resolved to A. But the runtime attribute pass
bound `@click`/`on*` handlers, scoped hand-written `id=`, and set `instantiator()` using B,
the component the content was rendered *inside*.

The same line of template obeyed two scope rules. A `<button $sid="view_as_client"
@click=this.view_as_client>` written in a sidebar slot had its id minted with A's cid and was
found by A's `$sid()` — while the click ran A's method with `this === Detail_Sidebar`, so
`this.args.id` was undefined and the endpoint received `{}`. No error at bind time or call
time.

## The fix

`content()` splices now carry the definer: the compiler emits
`['_content', instructions, definer]` and the instruction processor renders that block in
`definer`, honouring the per-element context it already recorded when applying attributes.

## What this test proves

1. `@click` in a `<Slot:>` body runs with `this` = the component whose template wrote it,
   and the receiver is not used.
2. `$sid` in a slot body scopes to the definer (unchanged behaviour, kept as a guard).
3. A hand-written `id=` in a slot body is scoped with the definer's cid.
4. A component written in a slot body reports the definer from `instantiator()`.
5. Default content between component tags behaves identically.
6. The child → slot data channel is untouched: `content('row', record, i)` delivers both
   values to `<Slot:row $params="record, index">`, and an undeclared slot still receives its
   value as a parameter named after the slot.
7. The receiver's own template is unaffected: its own `@click` binds to itself and its own
   `$sid` resolves only from itself.

Against the previous core, assertions 1, 3, 4 and 5 fail (9 of 17); all 17 pass now.
