# viewport_resize_override_filter

`on_viewport_resize()` is skipped for components whose hook is still the base no-op,
both at the lifecycle fires (after `on_render()` / `on_ready()`) and in the debounced
window resize dispatch (which still walks `$('.Component')`). This test checks that
nothing a component can observe changed.

| Group | Behavior |
|-------|----------|
| A | A class without an override inherits the base stub |
| B | Lifecycle calls unchanged: after `on_render()` and after `on_ready()`, again on `render()` |
| C | One resize = one call per live overriding component, in document order (not creation order) |
| D | Per-instance hooks: assigned in `on_create()`, defined as a class field, assigned to a live instance later |
| E | Stopped components (and children of a stopped parent) are not called, including one stopped by an earlier handler during the same dispatch |
| F | Detached (`.detach()`, native `remove()`) components are not called; re-inserted ones are again |
| G | A prototype patched after instances exist reaches those instances on the next resize |
| H | Nothing is called once every created component is stopped |

Resizes are synthetic `window` `resize` events (debounce 30ms, each followed by a 200ms wait).

## Run

```bash
cd tests/viewport_resize_override_filter && ./run-test.sh
```
