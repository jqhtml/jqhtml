# this.data Freeze Holes

## Purpose

The deep freeze trapped only assignment and `delete`. While `this.data` was frozen,
`Object.defineProperty`, `Object.setPrototypeOf` and `Object.preventExtensions` / `seal` /
`freeze` still went through (and freezing the target then broke every later nested read
with a Proxy invariant TypeError), a property descriptor handed out the raw nested object,
and `this.data` kept the very objects `on_create()` created, so `this.state.list =
this.data.list = []` let `this.state.list.push()` change frozen data.

## What This Tests

- **A/B.** Every mutation route throws on `this.data` and on nested values, naming the path.
- **C.** `Object.getOwnPropertyDescriptor(s)` hands out the read-only view.
- **D.** Error messages name the full dotted path (`this.data.nested.list[0].id`).
- **E.** `Holes_Target` (no `on_load()`): the aliased array is not part of `this.data`.
- **F.** Reads, and `Object.defineProperty` while unfrozen (in `on_create()`), still work.
- **G.** `Alias_Loader` (with `on_load()`): the same aliasing cannot reach `this.data` on
  the first render, before the load result replaces it.

## Expected Output

```
SUMMARY: 34 passed, 0 failed
```

## Implementation

`packages/core/src/data-proxy.ts` - `setup_data_property()`: one top-level handler and one
read-only handler per component, with `defineProperty`, `setPrototypeOf`,
`preventExtensions` and `getOwnPropertyDescriptor` traps; each wrapper's parent and key in a
per-component side table, and the path built only for an error message.
`packages/core/src/component.ts` - `create()`: `this.data` is replaced by its serializer
snapshot copy after `on_create()`.
