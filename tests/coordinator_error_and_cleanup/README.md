# Load Coordinator: Error Propagation and Registry Cleanup

Regression test for the deduplication coordinator's failure and cleanup paths
(`packages/core/src/load-coordinator.ts`, `data-proxy.ts`, `component.ts` `_load()`).

## What This Tests

**A. A leader `on_load()` failure settles its followers.**
Two `<Coord_Card $user_id=1>` boot together with an `on_load()` that rejects on the first
call for that id. Both must settle within one second. Previously the coordinator deleted
the entry without ever settling the promise the followers were parked on, so the follower
never rendered, never fired `ready`, and any `jqhtml.boot()` or `parent.ready()` above it
hung forever.

**B. The next component with that key is a new leader.**
A third card created afterwards runs `on_load()` itself (the second call succeeds).

**C. A leader with no followers leaves no entry behind.**
A single `<Coord_Card $user_id=2>`: after `ready()`, `Load_Coordinator.get_registry_state()`
is `{}`. Completed entries with an empty waiting list used to be kept forever, so the
registry grew once per distinct component+args for the lifetime of the page.

**D. Args changed after registration still resolve to the leader.**
`Coord_Parent` renders four cards sharing one key and, in `on_render()` - after the cards
have joined the group but while the leader's `on_load()` is still in flight - changes the
second card's `args.filter`. The coordinator must keep using the key that card captured
when it joined. Recomputing it from current args returned `null`, and the follower fired
`load`/`loaded` carrying its untouched `on_create()` data.

**E. Every component owns its data object.**
The leader's result is stored as JSON text and parsed once per follower, so no two
components share an object graph. Note that data cache mode re-normalizes each
component's data through a serialize/deserialize round trip, which masks a shared
reference - the `html` run is the one that actually proves this.

## Running

```bash
JQHTML_BROWSER=chromium ./run-test.sh
JQHTML_TEST_CACHE_MODE=html ./run-test.sh
```

`run-test.sh` exits non-zero if any assertion logs `FAIL:` or if the summary line never
appears. Every wait in the test races an explicit deadline, so a hang shows up as a failed
assertion rather than as a harness timeout.

## Notes for Editing This Test

- The cards in `coord_parent.jqhtml` deliberately carry no `$sid`: `$sid` lands in
  `this.args` and would give each card its own deduplication key.
- `Coord_Card.on_load()` awaits before it throws, so followers have time to join.
- `window.coord_fail_first[id]` makes the first `on_load()` for that id reject;
  `window.coord_load_calls[id]` counts calls; `this.data.seq` identifies which
  `on_load()` produced a given piece of data.
