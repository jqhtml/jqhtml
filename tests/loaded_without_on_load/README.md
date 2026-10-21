# loaded_without_on_load

Every component gets `on_loaded()` and the `loaded` event, whether or not it implements
`on_load()`. For a component without `on_load()` they run where `on_load()` would have
completed:

- **boot:** after the first render, before `on_ready()` (`on_render`, `on_loaded`,
  `loaded`, `on_ready`);
- **`reload()` / `refresh()`:** before the re-render (`on_loaded`, `loaded`, `on_render`,
  `on_ready`);
- **`load()`:** `on_loaded` and `loaded` only; returns `false`, `this.data` keeps what
  `on_create()` set, no render, no `on_ready()`.

A template-only component (no `on_load()`, no `on_loaded()`) still boots without yielding:
`loaded` has fired by the time `.component()` returns.

`_load_only` and `_load_render_only` suppress both, as they do for a component with
`on_load()`. A stopped component gets no `on_loaded()`, and a stop during an async
`on_loaded()` suppresses `loaded` and `on_ready()`.
