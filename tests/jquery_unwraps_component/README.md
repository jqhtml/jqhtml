# jquery_unwraps_component

**Mode:** all three cache modes

## Validates

`$(component)` returns the component's own jQuery element, so a component instance can be
passed anywhere a selector or element is accepted: `$(comp)[0] === comp.$[0]`,
`$(comp).addClass(...)` lands on the root element, and `$(comp).find(...)` /
`.children()` traverse the component's DOM. Ordinary `$()` arguments (elements,
selectors, `null`) are unaffected.

## Before the fix

`jquery-plugin.ts`'s `$()` override recognised a component by duck-typing
`typeof selector.id === 'function'` - a method `Jqhtml_Component` has never had. The
branch was dead, so `$(component)` fell through to the real jQuery constructor and wrapped
the plain object: `$(comp).length` was 1 but `[0]` was the component, `addClass()` was a
silent no-op on an object, and `find()` returned nothing. 8 of the 13 assertions fail
against that code.

## Related source

- `packages/core/src/jquery-plugin.ts` - the `$()` constructor override
- `docs/internal/audit_core_2026-09-14.md` - bug 24
