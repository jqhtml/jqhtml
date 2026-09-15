# this.data Deep Freeze

## Purpose

`this.data` is frozen outside `on_create()` and `on_load()`. The freeze used to trap only
TOP-LEVEL assignment and deletion, so `this.data.items.push(x)` and
`this.data.user.name = 'x'` in `on_ready()` mutated frozen data silently — while the
documentation promised that ANY modification throws. The freeze is now **deep**.

Also covers the read-only `this.args` view inside `on_load()`: it hands out one stable
wrapper per object, so `this.args.filter === this.args.filter`.

## What This Tests

### A. Nested mutation throws, naming the dotted path

All of these throw in `on_ready()`, and the message names the exact path:

| Attempt | Path in the error |
|---|---|
| `this.data.items.push(3)` | `this.data.items[2]` |
| `this.data.user.name = 'b'` | `this.data.user.name` |
| `delete this.data.user.x` | `this.data.user.x` |
| `this.data.items[0] = 9` | `this.data.items[0]` |
| `this.data.nested.list[0].id = 2` | `this.data.nested.list[0].id` |

After every rejected attempt `JSON.stringify(this.data)` still equals the `on_create()`
value — nothing partially applied.

### B. Reads are unchanged

The freeze must be invisible to anything that only reads. Asserted:
`this.data.items === this.data.items` (wrappers are memoized per object, so identity
comparisons hold), `Array.isArray`, `.length`, spread, `for..of`, `.map`, `.filter`,
`Object.keys`, `JSON.stringify` of the whole graph, and the template rendering nested
values.

### C. on_load() may mutate nested data

`Load_Mutation_Target` pushes and assigns into nested data inside `on_load()`. It
succeeds, `this.data` reflects it afterwards, and the result is deep-frozen again by
`on_ready()`.

### D. The object on_load() returned is not aliased into this.data

`on_load()` returns an object and keeps a reference to it on `window`. `this.data.payload`
is a separate object (every load result is round-tripped through the cache serializer),
and a mutation attempted through the frozen view throws without touching the original.

### E. this.args wrappers are stable inside on_load()

`this.args.filter === this.args.filter` and `this.args.filter.tags ===
this.args.filter.tags`. The read-only proxy used to build a fresh `Proxy` on every nested
read, so identity comparisons inside `on_load()` silently failed.

## Expected Output

```
SUMMARY: 31 passed, 0 failed
```

## Implementation Details

`packages/core/src/data-proxy.ts`:

- `setup_data_property()` — the top-level `get` trap returns a read-only wrapper for a
  nested object/array while `component.__data_frozen` is true, and the raw value when it
  is not (`on_create()`, `on_load()`'s detached run, `_apply_load_result()`). Wrappers are
  memoized in a `WeakMap` keyed by the raw target, which is what makes identity hold.
- Only plain objects and arrays are wrapped. `Date`, `Map`, `Set` and classes restored by
  `register_cache_class()` carry internal slots that a Proxy receiver cannot satisfy —
  wrapping them would break `this.data.created.getTime()` — so they pass through raw.
- `execute_on_load_detached()` — the read-only `this.args` proxy memoizes its nested
  wrappers for the duration of one `on_load()` call.

## Files

- `test.jqhtml` / `test.js` — parent; prints the summary in `on_ready()`
- `assert_helpers.js` — shared `window.deep_freeze_assert` / `window.deep_freeze_throws`
- `deep_freeze_target.jqhtml` / `.js` — groups A and B
- `load_mutation_target.jqhtml` / `.js` — groups C, D and E
- `run-test.sh` — test runner
