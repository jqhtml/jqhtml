# alive

`alive(value)` wraps a wait so that it never resumes on a stopped component: the returned
promise settles like `value` while the component lives and never settles once it is stopped.

- **A** - live: resolves with the value, rejects with the reason (try/catch works), a plain
  value resolves, pending until the wrapped promise settles.
- **B** - already stopped at the call: never settles (resolved, plain and rejected inputs).
- **C** - stopped while waiting, then the wrapped promise resolves: the code after the await
  does not run and the async function never settles.
- **D** - stopped while waiting, then it rejects: neither the next line nor the `catch` runs,
  and no `unhandledrejection` fires.
- **E** - an ancestor's `stop()`, a parent re-render (the replaced child; the parent itself
  still resolves) and a jQuery `.remove()` all count.
- **F** - a `finally` after the await runs while alive, not when stopped.
- **G** - throws in `on_load()` with an explanatory console error.
- **H** - `await this.alive(child.ready())` resumes when the child is ready, never resumes
  when this component stops first, and resolves when only the child stopped.

Source: `packages/core/src/component.ts` (`alive()`), `packages/core/src/data-proxy.ts`
(the `on_load()` error).
