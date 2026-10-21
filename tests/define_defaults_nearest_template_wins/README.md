# Define Defaults: Nearest Template Wins

When a `<Define>` and one of its ancestor `<Define>`s set the same attribute, the
**nearer** `<Define>` wins. The invocation beats all of them:

    invocation > child <Define> > parent <Define> > grandparent <Define> ...

## What this demonstrates

`_apply_default_attributes()` walked the template chain parent first and applied each
template's attributes "only if not already set". The farthest `<Define>` therefore won
every conflict: a parent `title="parent"` beat the child's own `title="child"`, a parent
`data-mode` beat the child's (in `this.args` and on the element), and a parent `color`
beat the child's in `style`.

The chain is now merged into one set of defaults first, nearer templates overriding
farther ones, and that set is applied once behind the invocation attributes:

- plain attributes: set only where the invocation did not (`=== undefined`, so an
  invocation `tabindex="0"` or `title=""` still wins)
- `data-foo` / `$foo` keys: one arg; set in `this.args`, `.data()` and as `data-foo` only
  if the invocation did not supply it. A child `data-foo` overrides a parent `$foo` and
  vice versa
- `style`: merged per property, nearer `<Define>` wins; an invocation property still wins
- `class`: merges, farthest `<Define>` first, exactly as before
- `tag`: never inherited

`$foo` on a compiled `<Define>` is a `defineArgs` default, not a `defaultAttributes` key,
and is already in `this.args` before defaults apply. A literal `$foo` key in
`defaultAttributes` comes only from a hand-written template; group F registers two to
cover it.

## Fixtures

- `dn_grand.jqhtml` / `dn_parent.jqhtml` / `dn_child.jqhtml` - a three-level `extends=`
  chain; each level sets `title`, `tabindex`, `data-mode`, `style` and `class`. Dn_Parent
  sets `data-kind`, which Dn_Child overrides with a `$kind` defineArgs default
- `dn_slot_base.jqhtml` / `.js`, `dn_slot_child.jqhtml` / `.js` - a slot-only JS subclass
  (`class Dn_Slot_Child extends Dn_Slot_Base`, no `extends=`) whose own `<Define>` sets
  `title`, `data-mode` and `style`
- `Dn_Hand_Base` / `Dn_Hand_Child` - hand-written templates registered in `test.js` with
  `$` and `data-` keys in `defaultAttributes`

## Assertions (29)

- A. Dn_Parent: its `title`, `data-mode` (args, attribute, `.data()`) and style `color`
  beat Dn_Grand's; properties only one Define sets are kept
- B. Dn_Child: the nearest Define wins for every key; the winning style properties come
  last (margin, padding, color);
  its `$kind` beats Dn_Parent's `data-kind`
- C. The class attribute is byte-identical to the pre-fix output
- D. The invocation beats every Define: `title`, `tabindex="0"`, `data-mode`, `$kind`,
  style `color`; class order unchanged
- E. The same precedence for the slot-only JS subclass
- F. Hand-written templates: child `$level` beats base `$level`, child `data-kind` beats
  base `$kind`, child `$flag` beats base `data-flag`; an invocation arg and `tabindex="0"`
  beat both

13 of the 29 fail on the pre-fix runtime (A, B, E and F).

## Related source

- `packages/core/src/component.ts` - `_apply_default_attributes()`,
  `resolve_parent_template()`
