# load_result_normalized

`this.data` is always jqhtml's own serialized copy of what `on_load()` returned -
in `none`, `data` and `html` cache mode alike. Before this, the serialize/
deserialize round trip ran only in `data` mode, so turning caching on could change
what a component saw.

Two properties follow from doing it unconditionally:

- **No aliasing.** The author's object graph never becomes `this.data`, so nothing
  the author still holds a reference to can mutate frozen data behind the
  framework's back.
- **Hot equals cold by construction.** `this.data` IS what the cache stores and
  what a cache hit returns. There is no second shape to get wrong.

## What survives, what does not

| Value | Result |
|---|---|
| `Date`, `Map`, `Set` | reconstructed |
| instance of a `register_cache_class()` class | reconstructed, methods callable |
| instance of an unregistered class | plain object of its own enumerable props |
| function, promise, DOM node, jQuery object, `Jqhtml_Component` | STRIPPED |
| cycle | cut (the rest of the graph still serializes) |
| two references to one object | two separate, deep-equal objects |

A stripped property is omitted from an object and becomes `null` in an array -
JSON's own semantics.

## Warnings

In development mode each stripped value prints exactly ONE `console.warn` per
`(component name, dotted path)` for the life of the page - not per instance, not
per load. The message names the component, the path, what kind of value it was,
and where the value belongs: `this.args` for callbacks, `this.state` for DOM
nodes/timers/files/sockets, `register_cache_class()` for model instances.
`jqhtml.configure({mode: 'production'})` converts silently.

The test asserts all of that, including that a `reload()` and a second instance
add no warnings, and that a differently-named component booted under production
adds none either.

## Source

- `packages/core/src/local-storage.ts` - `process_for_serialization`, `normalize_for_cache`
- `packages/core/src/component.ts` - `_apply_load_result()`, `load()`
- `docs/reference/15_deduplication_and_caching.md`
