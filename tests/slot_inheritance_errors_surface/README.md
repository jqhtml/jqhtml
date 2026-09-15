# Slot Inheritance Errors Surface

A slot-only template that cannot reach its parent template is an **error**, not an empty
render.

## What this demonstrates

A template whose top level is nothing but `<Slot:>` blocks is an override of a parent
template — it has no markup of its own. Two things can go wrong when the framework
resolves that parent, and both used to be swallowed in `component.ts` `_render()`:

| Failure | Old behaviour | New behaviour |
|---|---|---|
| The parent template throws while rendering | `catch` → `console.warn` → `instructions = []` | `Error` naming the child component AND the parent template |
| No parent template can be resolved at all | `console.warn('... rendering empty')` | `Error` naming the child component |

Both errors are raised from `_render()`, so they land on the boot error path: the error is
logged through `handleComponentError()`, the component is stopped (`_Component_Stopped`,
`_stopped === true`) and any ancestor parked in `_wait_for_children_ready()` is released by
the child's `stop` event.

This is audit bug 20 (`docs/internal/audit_core_2026-09-14.md`).

## Fixtures

- `sie_bad_parent.jqhtml` / `.js` — a parent template that reads `.deep` off an undefined
  value, i.e. throws from inside its own render function
- `sie_child.jqhtml` / `.js` — slot-only template; `class Sie_Child extends Sie_Bad_Parent`,
  so the parent template is found through the JS prototype chain
- `sie_orphan.jqhtml` — slot-only template with no `extends=` and no JS class at all

Both children are declared in `test.jqhtml` rather than created in `on_ready()`. That is
deliberate: they fail during the root's own `_render()`, so a regression that wedges the
parent produces no `SUMMARY:` line at all and `run-test.sh` fails on the missing summary.

## Assertions (10)

- A. An error reaching `console.error` names `Sie_Child` and `Sie_Bad_Parent`; the child
  is `_stopped` and carries `_Component_Stopped`
- B. An error names `Sie_Orphan` and says the slot-only template has no parent template;
  the orphan is `_stopped`
- C. The root reaches `on_ready()` within 1s of `on_create()` and is not itself stopped

## Related source

- `packages/core/src/component.ts` — `resolve_parent_template()` and the slot-only branch
  of `_render()`
- `packages/core/src/lifecycle-manager.ts` — `boot_component()`'s catch: log, then stop
