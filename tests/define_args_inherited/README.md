# Define `$` Arg Defaults Are Inherited

A `<Define>`'s `$foo` arg defaults (`defineArgs`) are inherited along the same template
chain as its attribute defaults: explicit `extends=""` first, then the JS class prototype
chain (slot-only JS subclasses included). The nearest `<Define>` that sets an arg wins.
`data-` attributes and args at the invocation win over every `<Define>`:

    farthest <Define> < nearer <Define>s < own <Define> < invocation data- < invocation args

## What this demonstrates

The constructor copied `defineArgs` from the component's own template only, so a child
`<Define extends="Parent">` (or a JS subclass) never received the parent's `$size`
default: `this.args.size` was `undefined`, the template rendered nothing, `on_load()`
read nothing and the cache key lacked the arg.

`$foo` and `data-foo` defaults are one arg, as in `_apply_default_attributes()`: the
nearer `<Define>` wins whichever spelling each uses. Within one `<Define>`, `$foo` wins
over its own `data-foo`, as before.

## Fixtures

- `ia_base` - `$size`, `$level`, `$flag`
- `ia_mid` extends `ia_base` - `$level`, `$mid_only`
- `ia_sized` extends `ia_base` - its own `$size`
- `ia_leaf` extends `ia_mid` - `$level` (three-level chain)
- `ia_slot_base` / `.js`, `ia_slot_child` / `.js` - slot-only JS subclass
  (`class Ia_Slot_Child extends Ia_Slot_Base`, no `extends=`)
- `ia_data_mid` extends `ia_base` with `data-size`; `ia_data_leaf` extends it, sets nothing
- `ia_data_top` with `data-size`; `ia_arg_mid` extends it with `$size`; `ia_arg_leaf`
  extends that, sets nothing
- `ia_loaded` / `.js` extends `ia_base`, with an `on_load()` that records `this.args.size`

## Assertions (34)

- A. `ia_mid` gets the parent's `$size` and `$flag` (args and rendered); its own `$level` wins
- B. `ia_sized`'s own `$size` beats the parent's; an unset arg is still inherited
- C. `ia_leaf`: `$size`/`$flag` from the grandparent, `$mid_only` from the parent, `$level`
  set at all three levels resolves to the leaf's
- D. Slot-only JS subclass: `$size` from the parent, own `$level` wins, the parent template
  renders the inherited arg
- E. Invocation `$size`/`$level` and a programmatic `.component('Ia_Leaf', {size})` beat all
- F. Invocation `data-size`/`data-level`, and `data-size` on the element given to
  `.component()`, beat all
- G. Mixed spellings: a nearer `data-size` beats a farther `$size` and vice versa, also
  when the component itself sets neither
- H. `on_load()` reads the inherited arg and the cache key contains it

16 of the 34 fail on the pre-fix runtime (A, B, C, D, E, G and H). G's
`ia_data_leaf` case passes on both; it guards against an implementation that lets a
farther `$size` block a nearer `data-size`.

## Related source

- `packages/core/src/component.ts` - `resolve_template_chain()`, `merge_define_args()`,
  the constructor's `this.args` merge, `_apply_default_attributes()`
