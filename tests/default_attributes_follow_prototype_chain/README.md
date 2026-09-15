# Default Attributes Follow the Prototype Chain

`<Define>` default attributes resolve through **exactly the same chain templates do**:
explicit `extends=""` first, then the JS class prototype chain.

## What this demonstrates

`_apply_default_attributes()` used to walk only the `extends=` chain. A slot-only JS
subclass — `class Da_Child extends Da_Base` with its own `<Define:Da_Child>` containing
only slots and no `extends=` — therefore inherited its parent's **template** but none of
the parent `<Define>`'s `class=""`, `role=""` or other attributes. The markup came from
one chain and the styling from another.

Both paths now call the same `resolve_parent_template()` helper, so they cannot disagree.

A second, smaller defect is covered here: the guard for "is this attribute already set at
the invocation?" was `if (!this.$.attr(key))`, which treats an empty-string attribute as
unset. An invocation `title=""` was silently replaced by the `Define` default. It is now
`if (this.$.attr(key) === undefined)`.

These are audit bug 21 and the `component.ts ~:2170` LOW entry
(`docs/internal/audit_core_2026-09-14.md`).

## Fixtures

- `da_base.jqhtml` / `.js` — `<Define:Da_Base class="card" role="region" tabindex="-1"
  title="define default">`, plus the template body
- `da_child.jqhtml` / `.js` — slot-only `<Define:Da_Child>` with NO `extends=`;
  `class Da_Child extends Da_Base`

## Assertions (12)

- A. `Da_Child` gets `class="card"`, `role="region"` and `tabindex="-1"` from `Da_Base`'s
  `<Define>`, while still rendering the inherited template body and keeping its own
  `Da_Child` component class
- B. An invocation `tabindex="0"` and an invocation `title=""` both survive; a `Da_Base`
  with no `title` still receives the `Define` default
- C. The same holds for a component created with `$('<div tabindex="0">').component(...)`

## Related source

- `packages/core/src/component.ts` — `resolve_parent_template()`,
  `_apply_default_attributes()`
