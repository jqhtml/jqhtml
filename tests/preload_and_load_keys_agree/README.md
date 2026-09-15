# preload_and_load_keys_agree

## What this demonstrates

The cache key is derived in exactly one place — `generate_cache_key()` in
`packages/core/src/component-cache.ts` — and that one key is what the cache is read with
in `create()`, written with by `load()`, and matched against by SSR preload.

Audit bug 14: there used to be three derivations. `component.ts` `load()` and
`preload-data.ts` `set_preload_data()` both built keys WITHOUT content serialization,
while `_load()` and the create-phase cache read used it. Consequences:

- a component with a plain-data object arg computed a null key inside `load()`, so
  `load()` silently never wrote the cache that `create()` would later read;
- the same component's preload entry was dropped by `set_preload_data()`, so SSR preload
  never applied to it;
- a `cache_id()` component's key shape (`<Name>::<cache_id()>`) cannot be derived from
  args at all, so its preload entry never matched either.

Also covers the LOW finding on the same lines: a `cache_id()` that threw inside `load()`
was swallowed by a bare `catch`, leaving no trace anywhere.

## Assertions

1. **Object-arg preload** (all modes) — an entry with no `key`, whose args contain a
   plain-data object, hydrates `Pk_Obj`; `on_load()` never runs.
2. **`cache_id()` preload** (all modes) — an entry carrying `key: 'Pk_Id::custom_1'`
   hydrates `Pk_Id`; `on_load()` never runs, and the key the component used is that key.
3. **`load()` cache write** (`data` mode only) — after `load()` picks up changed data, a
   freshly created component with a NEW but content-equal object arg is already holding
   the loaded value when `create()` returns, which can only have come from the cache.
4. **Throwing `cache_id()` in `load()`** (all modes) — `cache_id()` is armed to throw only
   after boot, so the throw is first seen by `load()`. `load()` still completes, the
   element carries `data-nocache="cache_id():cache-id-threw"`, and development mode emits
   exactly one warning across two loads (the warn-once mechanism in `component-cache.ts`).

Every wait races a timeout, so a regression that hangs fails rather than producing no
summary.

## Related source

- `packages/core/src/component-cache.ts` — `generate_cache_key()`, `warn_uncacheable_component()`
- `packages/core/src/component.ts` — `load()`, `_load()`
- `packages/core/src/preload-data.ts` — `PreloadEntry.key`, `capture_component_data()`, `set_preload_data()`
