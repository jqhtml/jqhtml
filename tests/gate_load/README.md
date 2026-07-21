# gate_load() Lifecycle Test

Validates the `this.gate_load(promise)` affordance on `@jqhtml/core` Component.

## What gate_load() does

A component may register one or more promises ("load gates") during `on_create()`.
Before the component's **first** `on_load()` runs, the lifecycle awaits all
registered gates together via `Promise.allSettled()`. jqhtml has no knowledge of
what is being awaited — the caller supplies the promise, and policy such as
timeouts is the caller's responsibility.

Gates delay **only** the `on_load` phase. `create()`, the initial template render,
`on_render()`, and (in cache modes) the cached-content first paint all happen
before the gate — stale-while-revalidate is preserved, so only the revalidating
fetch waits.

## Assertions (26 total)

| # | Group | What it proves |
|---|-------|----------------|
| 1–3 | **A** | A pending gate defers the first `on_load`; it runs once the gate resolves; content updates. |
| 4–6 | **G** | The initial paint renders **synchronously** before the gate — the gate never moves the first render later. |
| 7–9 | **B** | Multiple gates accumulate and are all awaited; the load runs only after every gate settles. |
| 10–11 | **C** | A **rejected** gate does not block or abort the load — it is logged (debug channel) and loading proceeds. |
| 12–13 | **D** | `reload()` after the first load re-runs `on_load` without re-awaiting gates (gates are one-shot). |
| 14 | **E** | Calling `gate_load()` after the first load has started **throws**. |
| 15 | **F** | A component with **no** custom `on_load()` ignores gates — no throw, no delay, reaches ready with an unresolved gate. |
| 16–18 | **H** | `stop()` during the gate wait abandons the load cleanly; a late gate settlement is a no-op. |
| 19–23 | **I** | `reload()` while gated **resumes** the paused lifecycle (runs `on_load` despite an unresolved gate); a later gate settlement does nothing; a subsequent `reload()` behaves normally. |
| 24–25 | **J** | `refresh()` while gated also resumes the lifecycle. |
| 26 | **K** | In SSR (data-capture enabled) gates are a **no-op** — the load runs without awaiting the gate. |

## Resume triggers (the "whichever comes first" rule)

While a component is gated (first `on_load` paused), the wait is released by
whichever of these fires first — the rest become no-ops:

- all gate promises settle,
- `reload()` is called (resumes instead of its normal debounced behavior),
- `refresh()` is called (same),
- `stop()` is called (abandons the load).

## Implementation

- `packages/core/src/component.ts` — `gate_load()`, `_await_load_gates()`, the
  `reload()` short-circuit, and the `_stop()` resume.
- `packages/core/src/lifecycle-manager.ts` — the boot seam that awaits gates
  immediately before the first `on_load`.

## Running

```bash
cd tests/gate_load
./run-test.sh                            # none mode
JQHTML_TEST_CACHE_MODE=data ./run-test.sh
JQHTML_TEST_CACHE_MODE=html ./run-test.sh
```

The harness controls gate timing through `window.__gate_registry` (deferred
promises keyed by `gate_key`) and reads per-key lifecycle counters from
`window.__gate_counts`.
