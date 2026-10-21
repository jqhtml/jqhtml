# reload_cache_write_and_nocache

`reload()` with new cacheable args writes the cache under the new key even when the
loaded data equals the previous load's, so a fresh boot with those args hits the cache.
With the same key and unchanged data it still writes nothing. `reload()` into args that
cannot be keyed sets `data-nocache` and prints the dev warning, exactly as boot and
`load()` do (gated by `warn_uncacheable_args`); cacheable args again, on any path,
remove a stale `data-nocache`.

- A. boot id 1: one entry written (data/html modes)
- B. reload with id 2, same data: one entry written under the new key
- C. reload and refresh with the same key and data: no write
- D. a fresh boot with id 2 shows the cached content before its on_load() finishes
- E. reload into a function arg: `data-nocache="on_pick:function"` and the warning
- F. with `warn_uncacheable_args: false` the reload marks the element but does not warn
- G. reload back to cacheable args removes `data-nocache`
- H. boot and `load()` mark and warn as before; `load()` and boot with cacheable args remove a stale `data-nocache`

Run: `./run-test.sh` (set `JQHTML_TEST_CACHE_MODE=data|html|none`).
