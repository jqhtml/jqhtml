# is_stopped

`is_stopped()` is the public stopped state: `false` through boot, ready, `render()` and
`reload()`; `true` from the start of `stop()` (already inside `on_stop()`) and never false
again.

- **A** - false while boot is held in `on_load()`, in every hook, after ready, `render()`
  and `reload()`.
- **B** - true inside `on_stop()` and after `stop()`, on the child and grandchild too.
- **C** - true while the element is still in the document (`is_attached()` is false).
- **D** - a detached live component is not stopped.
- **E** - a parent re-render and a jQuery `.remove()` stop it.
- **F** - an `await ready()` released by a stop sees `true`.
- **G** - `is_stopped()` and `is_attached()` throw a specific error in `on_load()` and
  `on_load_error()` (they may serve several deduplicated components).

Source: `packages/core/src/component.ts` (`is_stopped()`, `_stop()`).
