# Render benchmarks

Paired A/B timing of the jqhtml runtime: the working tree's `packages/core/dist`
against the build recorded at the commit in `BASELINE_COMMIT`. Not a pass/fail suite
and not part of `run-all-suites.sh`; run it when a change is meant to be faster, or to
check one has not become slower.

```bash
node tests_benchmark/run.cjs                  # every scenario
node tests_benchmark/run.cjs tracked_elements # one scenario
node tests_benchmark/run.cjs --rounds=9       # more pages per scenario (default 5)
node tests_benchmark/profile.cjs rerender     # CPU profile of one scenario, current runtime (Chromium only: CDP)
node tests_benchmark/run.cjs --browser=firefox   # same scenarios on another engine (chromium default; firefox, webkit)
```

Run a second engine before adding any per-browser code path: a win that shows on both
Chromium and Firefox is ours; one that shows on only one is the engine's, and a branch
per engine is rarely worth its cost in readability.

## How a comparison is made

Both runtimes are bundled for the same scenario and loaded into one page. Each
iteration alternates which runtime is active (order flipped every iteration), so both
sample sets see the same machine load, JIT state and GC pressure. The reported change
is the median of per-iteration paired ratios; a scenario is PASS when current is at
least 3% faster, FLAT within 3%, SLOWER beyond. On a quiet machine identical code reads
within about 2%; on a loaded one within about 5%, so treat single-digit results with
care and re-run.

The baseline is read straight from git (`git show <commit>:packages/core/dist/jqhtml-core.esm.js`),
so nothing needs checking out. Move `BASELINE_COMMIT` forward after a release so
the comparison is always against the last shipped runtime. The parser is always the
working tree's: only the runtime differs between the two bundles.

## Scenarios

| Directory | What it stresses |
|---|---|
| `escape_heavy` | 1500 rows x 6 interpolations of strings that need escaping |
| `tracked_elements` | 3600 elements carrying `$sid` / `@click` / `data-*` (post-innerHTML lookup and attribute application) |
| `many_components` | 800 child components under one parent (lookup, construction, boot fan-in) |
| `rerender` | 300 children, `render()` four times (stop children, clear, rebuild) |
| `off_dom` | 800 children rendered on a detached element (the off-DOM child discovery path) |

A scenario is a directory with `.jqhtml` templates (and paired `.js` classes) plus
`bench.js`, which sets `window.jqhtml_bench = { name, run }`. `run()` should return
`window.bench_measure(async () => { ...one mount-and-ready cycle... })`, which does the
warm-up, alternation and sampling. Scale a scenario so one iteration takes at least
tens of milliseconds; below that the noise floor swamps a 3% change.

## History

| Date | Change | Scenario | Result |
|---|---|---|---|
| 2026-09-14 | String-based `escape_html` (no `createElement` per value) | escape_heavy | -27% |
| 2026-09-14 | One `querySelectorAll` per pass instead of a `querySelector` per tracked element / component | tracked_elements, many_components, off_dom | -57%, -25%, -19% |
| 2026-09-14 | `uid()` without split/join; single-pass tag attribute build | all | within noise, reverted |
| 2026-09-14 | Native `setAttribute` instead of jQuery `attr()` in `apply_attributes` | tracked_elements | within noise, reverted |
| 2026-09-14 | Same two kept changes measured on Firefox 142 | escape_heavy, tracked_elements, many_components, off_dom, rerender | -27%, -34%, -15%, -14%, flat |
| 2026-09-14 | Same two kept changes measured on WebKit 26 | escape_heavy, tracked_elements, many_components, off_dom, rerender | -21%, -60%, -23%, -21%, flat |
