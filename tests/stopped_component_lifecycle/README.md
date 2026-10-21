# Stopped Component Lifecycle

Regression test: a component stopped while its lifecycle is in flight runs no further
hooks (`packages/core/src/component.ts` `_ready()` and `_load()`).

## What This Tests

**A. Child stopped while waiting for its children.** `Stop_Wait_Parent` renders a
`Stop_Wait_Child` whose `Stop_Wait_Grand` has a slow `on_load()`. Removing the child's
element with jQuery stops it while its ready phase waits; the child must never run
`on_ready()`, never fire `ready`, and keep its stopped ready state. The parent that was
waiting on it reaches ready. (Before the lifecycle queue this re-rendered the parent
mid-boot; that render now waits for the parent's boot to finish.)

**B/C. Component removed mid-fetch.** A `Stop_Load_Card` stopped during `on_load()`
(B as a dedup leader with no followers, C with a function arg and so no dedup key) never
runs `on_loaded()` or fires `loaded`/`ready`, and the fetched data is not applied.

**D. Dedup leader stopped mid-fetch with two followers.** The followers still receive the
leader's data, run `on_loaded()` and reach ready; the stopped leader takes nothing; only
one `on_load()` ran and the coordinator registry is empty.

**E. Dedup follower stopped while waiting.** The leader completes; the stopped follower
runs no `on_loaded()` and fires nothing; the registry is empty.

Every wait races a deadline, so a hang is a failed assertion.

## Running

```bash
JQHTML_BROWSER=chromium ./run-test.sh
JQHTML_TEST_CACHE_MODE=html ./run-test.sh
```
