# on_load_error_hook

`on_load_error(error)`: the framework's recovery path for a failed `on_load()`
(`docs/reference/14_lifecycle_complete_specification.md`, section 4c).

Each `Le_*` component's `on_load()` is `le_load()` from `le_shared.js`, which throws
`new Error('le boom <key>')` while `window.__le.fail[key]` is positive. The classes differ
only in their `on_load_error()`:

| Component | on_load_error() |
|---|---|
| `Le_Plain` | not overridden |
| `Le_Fallback` | sets fallback data; probes `this.$` and `this.args` |
| `Le_Super` | calls `super.on_load_error(error)`, then sets fallback data |
| `Le_Rethrow` | rethrows |
| `Le_Async` | awaits, then sets fallback data |

Sections:

- **A.** Boot failures, one child of `Le_Parent` per variant: no override prints the error
  once, stops the child and releases the parent; an override prints nothing, renders its
  fallback and fires `ready`; `super` prints once and continues; a rethrow stops; an async
  override is awaited. `this.$` is blocked in the hook, and the hook cannot be called
  manually. Nothing is written to the cache.
- **B.** Deduplication: three same-args components, one failed `on_load()`, three hook runs
  with the same error object, three fallbacks, empty coordinator registry, no cache write.
- **C.** After a failure the instance never reads or writes the cache, even on later
  successful `reload()` calls (one to args that are cached, one to args that are not).
- **D.** Without an override, a failed `reload()`/`refresh()`/`load()` rejects, prints the
  error once and leaves `ready()` resolvable (also for a waiter registered mid-load).
- **E.** With an override, they resolve, apply the fallback (rendered for `reload()` and
  `refresh()`), leave `ready()` resolvable, and write nothing to the cache.

Uses the console and `Storage.prototype` spies; restores both before reporting.
`--expect-boot-errors` because `Le_Plain` and `Le_Rethrow` deliberately fail their boot.
