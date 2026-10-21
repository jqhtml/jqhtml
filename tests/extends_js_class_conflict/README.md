# extends= vs the JS Class Parent

A template's `extends=""` must agree with its component's JS class, or the component throws.

## The rule

Take the component class's JS ancestors up to `Jqhtml_Component`, keeping only those with a
template of their own.

- Empty list (class extends `Jqhtml_Component` directly, only template-less helper classes
  in between, or a template-only component with no class): no conflict.
- Otherwise `extends=` must name one of them - any ancestor, not only the direct parent.
- An `extends=` naming an unregistered template is not a conflict; resolution falls back to
  the prototype chain.
- Anything else throws from `_render()`: logged naming the component, the `extends=` target
  and the templated ancestors; the component is stopped; waiting ancestors are released.

Before the fix, `extends=` won silently: `Ejc_Conflict` rendered `Ejc_Grid_A`'s markup
over `Ejc_Grid_B`'s methods.

## Fixtures

| Component | Template | Class | Expected |
|---|---|---|---|
| `Ejc_Grid_A`, `Ejc_Grid_B` | full, marker `a` / `b` | extends `Jqhtml_Component` | parents |
| `Ejc_Grid_Mid` | full, marker `mid` | extends `Ejc_Grid_B` | intermediate layer |
| `Ejc_Helper`, `Ejc_Helper_B` | none | extend `Jqhtml_Component` / `Ejc_Grid_B` | helper classes |
| `Ejc_Conflict` | slot-only, `extends="Ejc_Grid_A"` | extends `Ejc_Grid_B` | throws |
| `Ejc_Full_Conflict` | full, `extends="Ejc_Grid_A"` | extends `Ejc_Grid_B` | throws |
| `Ejc_Skip` | slot-only, `extends="Ejc_Grid_B"` | extends `Ejc_Grid_Mid` | renders B |
| `Ejc_Via_Helper` | slot-only, `extends="Ejc_Grid_A"` | extends `Ejc_Helper` | renders A |
| `Ejc_Helper_Between` | slot-only, `extends="Ejc_Grid_B"` | extends `Ejc_Helper_B` | renders B |
| `Ejc_Direct` | slot-only, `extends="Ejc_Grid_A"` | extends `Jqhtml_Component` | renders A |
| `Ejc_Slot_Proto` | slot-only, no `extends=` | extends `Ejc_Grid_B` | renders B |
| `Ejc_Full_Own` | full, `extends="Ejc_Grid_B"` | extends `Ejc_Grid_B` | renders its own markup only |
| `Ejc_Missing` | slot-only, `extends="Ejc_Not_Registered"` | extends `Ejc_Grid_B` | renders B (fallback) |
| `Ejc_Tpl_Only` | slot-only, `extends="Ejc_Grid_A"` | none | renders A |
| `Ejc_Late` | slot-only, `extends="Ejc_Late_Target"` | extends `Ejc_Grid_B` | renders B, then throws once the test registers `Ejc_Late_Target` (cached verdict reset) |

`Ejc_Missing` also covers the resolution order (explicit `extends=`, then the prototype
chain) that the planned `template_inheritance_resolution_order` test was meant to pin.

## Related source

- `packages/core/src/component-registry.ts` - `extends_conflict()`
- `packages/core/src/component.ts` - `_render()` (the call) and `resolve_parent_template()`
