# component_replacement_edge_cases

**Mode:** all three cache modes

## Validates

Three edge cases of `.component('Name', args)` on an element that already carries a
component (`jquery-plugin.ts`'s setter path):

**A. The class attribute is removed, not emptied.** When the strip of component classes
leaves nothing, the attribute goes away entirely instead of becoming `class=""`. The
replacement's new component re-adds classes immediately, so the intermediate state is
observed with a `MutationObserver`: each record's `oldValue` is what the previous mutation
left behind, so `null` proves the attribute was absent and `""` proves the bug.

**B. A throwing `stop()` aborts the replacement.** The caller asked to replace a live
component; if its cleanup fails, overwriting it would leave the old component's timers and
listeners running against destroyed DOM. The throw now reaches the caller and the element
keeps its old component.

**C. A tag mismatch is repaired with empty inner content, and `.data()` survives.** The
element is a `<div>` with no content and no `_inner_html`; the template declares
`tag="span"`. The element is replaced, and the new element inherits the old one's
attributes, its non-component classes and its jQuery data store.

## Before the fix

A: `element.attr('class', nonComponentClasses.join(' '))` wrote `class=""`.
B: `stop()` was wrapped in a `try/catch` that warned and continued with the overwrite.
C: the replacement only ran `if (args._inner_html)`, so an element with no server-rendered
content (including a `boot()` placeholder that was empty - `boot.ts` empties the
placeholder before it sets `_inner_html`) kept the wrong tag with only a warning, and the
jQuery data store was never copied. 7 of the 17 assertions fail against that code.

## Related source

- `packages/core/src/jquery-plugin.ts` - `.component()` setter: replacement and tag check
- `packages/core/src/boot.ts` - where `_inner_html` comes from
- `docs/internal/audit_core_2026-09-14.md` - the LOW items on `jquery-plugin.ts:178-190` and `:236-254`
