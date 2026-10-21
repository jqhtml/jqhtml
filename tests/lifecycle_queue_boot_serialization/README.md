# lifecycle_queue_boot_serialization

**Modes:** all three (`none`, `data`, `html`). The cache-key assertions in section 1 run in
`data` and `html`.

Boot is the first entry on the component's lifecycle queue (`component-queue.ts`). Every
cycle - boot or a queued `render()`/`load()`/`reload()`/`refresh()` - holds the component's
lock from its start through the end of its own `on_ready()`. If boot ends with calls still
queued, `ready` fires once the queue is idle.

1. `reload()` with new args during the boot `on_load()` (the old-args response is the slow
   one): the loads do not overlap, the new-args data stands, nothing under the new-args
   cache key holds old-args data (data mode: the new-args data is there), `ready` fires
   once, with the new data. Awaited from outside during the boot `on_load()`, that
   `reload()` resolves after its turn and prints no warning.
2. `render()` during the boot load: `on_ready()` never runs before the data arrives, and
   `ready` fires once, with loaded data.
3. `load()`, `render()`, `reload()`, `refresh()` called during boot run after it, in call
   order, never overlapping; `ready` fires once, and a `ready()` waiter registered during
   boot resolves only after the last queued load.
4. Adjacent identical calls merge: three `load()` calls behind a running one run once more,
   and all callers get that run's result; two `render()` calls render once.
5. Non-adjacent or different calls do not merge: `reload, refresh, reload`; `load, render,
   load`; `reload(true), reload(false)`.
6. A call never merges into the running entry; a waiting entry reads `this.args` when it
   starts.
7. The `on_ready() { if (cond) { this.reload(); return; } }` pattern: the reload starts only
   after `on_ready()` returns, `on_ready()` runs again on the reload cycle, an external
   `await comp.ready()` resolves only after the reload, `ready` fires once, and nothing is
   warned.
8. Load sequencing: of two overlapping loads (only reachable by calling `_reload()`
   directly), the older result is dropped.
9. Development warnings: `load()` from `on_create()` and `refresh()` from `on_render()` warn
   at once. Awaiting `reload()` in `on_loaded()` warns once with the exact message (that
   component is deadlocked on purpose). An unawaited `reload()` in `on_loaded()` completes
   silently, awaiting `reload()`/`refresh()` from outside after ready is silent, and no
   "possible deadlock" timer warning exists.
10. Awaited `render()`, `load()` and `reload()` inside `on_ready()` each run at once, nested,
   and resolve (`load()` with its own result); `ready` fires once, after `on_ready()`; no
   warning.
11. An awaited `reload()` in `on_ready()` is pulled forward without letting the `reload()`
   and `render()` made after it run early: those wait for `on_ready()` to return, the later
   `reload()` does not merge into the promoted one, and `ready` fires once, after the queue
   drains.
