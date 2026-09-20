# coordinator_follower_class_instances

jqhtml copies `on_load()` data in two places, and both go through ONE serializer:

- **Path A** - `normalize_for_cache()`: every `on_load()` result becomes `this.data`
  through the cache serializer, which is also what localStorage stores and returns.
- **Path B** - `Load_Coordinator`: a deduplicated follower never runs `on_load()`; it
  takes a copy of its leader's `this.data`. That copy is made by
  `Jqhtml_Local_Storage.serialize()` / `deserialize()`.

Before this, path B was a plain `JSON.stringify` / `JSON.parse`. That consulted every
instance's `toJSON()` and handed the follower a wire form nothing could restore, so the
leader rendered against class instances and every follower against plain objects.
The first method call on a follower's data threw `... is not a function` - and only
on the page loads whose timing produced a follower, so it looked random.

## What the test does

Three `Cfc_Item` with identical args are mounted at once, so one leads and two follow.
`on_load()` returns instances of:

| class | why it breaks a JSON round trip |
|---|---|
| `Cfc_Rich_Text` | defines `toJSON()` whose shape is not its own properties; registered with `from_plain` |
| `Cfc_Money` | state in a private field; registered with `to_plain` + `from_plain` |
| `Cfc_Plain_Model` | defines `toJSON()` but is registered with no options (own-props path must bypass it) |
| `Date`, `Set`, `Map` (holding a `Cfc_Money`) | built-ins, now on the same restore hook |

The template renders by calling methods on all of them. The test asserts that every
instance - leader and followers - holds live instances, rendered correctly, and that the
followers' data deep-equals the leader's without sharing an object.

In `data` mode a fourth instance is mounted afterwards: its first render must come
from the cache (before its `on_load()` completes), the cached data must hold live
instances, and the server load that follows must compare equal and not redraw.

## Registering a class with a wire form

```javascript
jqhtml.register_cache_class(Rich_Text, {
  from_plain: (plain) => new Rich_Text(plain.raw)   // to_plain defaults to instance.toJSON()
});
jqhtml.register_cache_class(Money, {
  to_plain:   (money) => money.cents,
  from_plain: (cents) => new Money(cents)
});
```

## Source

- `packages/core/src/local-storage.ts` - `register_cache_class()`, `serialize()`, `deserialize()`
- `packages/core/src/load-coordinator.ts` - `_complete_coordination()`, `get_leader_data()`
- `packages/core/test/serializer-restore-hooks.test.js` - unit test of both paths
- `docs/reference/15_deduplication_and_caching.md`
