# reload_cache_key_refresh

`reload()` recomputes the cache key from the current args on every call and stores it
even when it is null. Args that cannot be keyed (here, a function arg) then write
nothing, instead of writing their data under the previous args' entry; new cacheable
args write under their own key. In html cache mode the reload snapshots the markup it
rendered, so a fresh boot with the same args starts from the post-reload markup.

- A. boot page 1: one entry for page 1 (data/html modes)
- B. reload with page 3 plus a function arg: page 3 renders, no entry holds it, the page 1 entry is untouched
- C. reload with page 2: a separate page 2 entry, the page 1 entry still holds page 1
- D. reload page 2 with new data, then boot a second instance on page 2 with its on_load() held: it shows the post-reload page from the cache

Run: `./run-test.sh` (set `JQHTML_TEST_CACHE_MODE=data|html|none`).
