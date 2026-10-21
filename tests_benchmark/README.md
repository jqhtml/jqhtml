# Render benchmarks

Paired A/B timing of the jqhtml runtime: the working tree's `packages/core/dist`
against the build recorded at the commit in `BASELINE_COMMIT`, with an A/A control
beside every comparison. Not a pass/fail suite and not part of `run-all-suites.sh`
(the method's unit tests are: `node --test tests_benchmark/test/method.test.cjs`); run
it when a change is meant to be faster, or to check one has not become slower.

```bash
node tests_benchmark/run.cjs                  # every scenario
node tests_benchmark/run.cjs tracked_elements # one scenario
node tests_benchmark/run.cjs --rounds=9       # more pages per scenario (default 5)
node tests_benchmark/run.cjs --seed=1234      # replay the run order of an earlier run (the seed is in its header)
node tests_benchmark/run.cjs --no-aa          # skip the A/A control: two sides per iteration instead of three
node tests_benchmark/profile.cjs rerender     # CPU profile of one scenario, current runtime (Chromium only: CDP)
node tests_benchmark/run.cjs --browser=firefox   # same scenarios on another engine (chromium default; firefox, webkit)
node tests_benchmark/run.cjs --baseline=HEAD     # baseline = another commit (uncommitted work vs the last commit)
```

All eight scenarios at the default 5 rounds take about 9 minutes on Chromium with the
A/A control and about 5 minutes with `--no-aa` (the old two-sided harness: about 5
minutes). With identical code on both sides (`--baseline=HEAD` and no changes to
`dist/`) every A/B and A/A change reads within about 3%, mostly within 1%.

Run a second engine before adding any per-browser code path: a win that shows on both
Chromium and Firefox is ours; one that shows on only one is the engine's, and a branch
per engine is rarely worth its cost in readability.

## How a comparison is made

Three bundles of the scenario are loaded into one page: `baseline`, `current`, and
`baseline_aa`, a second, independent copy of the baseline (its own runtime instance).
Every iteration runs each of them once, so the sample sets see the same machine load,
JIT state and GC pressure. Each round is a fresh page.

- **Order.** The bundle load order, the warm-up order and the order within each
  iteration come from a seeded random generator. Each random order is followed by its
  reverse, so every side runs before and after every other side equally often. The seed
  is printed; `--seed=N` reproduces the orders (not the timings).
- **Equal conditions.** jqhtml's `init()` wraps `jQuery.fn.html`/`on`/`find`/`val`,
  `jQuery.cleanData` and others. The page snapshots jQuery before any bundle loads and
  restores it before each bundle loads and before every switch of runtime, so each side
  runs with exactly one layer of its own wrappers, as in production.
- **Estimate.** For each side against baseline, the paired ratios are split by whether
  the side ran before or after baseline in that iteration; the change is the geometric
  mean of the two medians, so any effect of running first or second cancels.
- **A/A control.** `baseline_aa` against `baseline` is measured the same way. Its change
  and the 95% bootstrap interval of that change (resampled over iterations) are printed
  next to the A/B change: this is the noise floor of the run. An A/B change inside the
  interval (|A/B| no larger than the interval's larger end) is marked `n.s.`.

Verdicts: **PASS** when current is at least 3% faster and outside the A/A interval,
**SLOWER** for the same in the other direction, **NOISE** when the change passes 3% but
lies inside the interval, **FLAT** under 3%. Scale a scenario so one iteration takes at
least tens of milliseconds; below that the noise floor swamps a 3% change.

Before 2026-10-20 the harness ran the two sides in a fixed alternation and let both
runtimes wrap the same jQuery on every switch. The wrappers stacked (45 `cleanData`
layers by the end of a 21-iteration page), so every sample was slower than the one
before it and the side that ran second in an iteration paid one more layer than the
side that ran first: in an A/A run the paired ratios of the two orders differed by 2 to
6 points. With 11 iterations in one order and 10 in the other, the median of all paired
ratios did not cancel that, and identical code was reported up to 10% slower on
`load_table_boot`. Results in the history below from before that date carry the bias;
the changes larger than 10% stand.

The baseline is read straight from git (`git show <commit>:packages/core/dist/jqhtml-core.esm.js`),
so nothing needs checking out. Move `BASELINE_COMMIT` forward after a release so
the comparison is always against the last shipped runtime. Each bundle's templates are
compiled by its own commit's parser (also read from git): the compiled template format
is a contract between parser and core, so a baseline runtime cannot run templates from a
newer parser.

## Scenarios

| Directory | What it stresses |
|---|---|
| `escape_heavy` | 1500 rows x 6 interpolations of strings that need escaping |
| `tracked_elements` | 3600 elements carrying `$sid` / `@click` / `data-*` (post-innerHTML lookup and attribute application) |
| `many_components` | 800 child components under one parent (lookup, construction, boot fan-in) |
| `rerender` | 300 children, `render()` four times (stop children, clear, rebuild) |
| `off_dom` | 800 children rendered on a detached element (the off-DOM child discovery path) |
| `load_table_boot` | Boot of a component whose `on_load()` returns 1000 rows x 8 fields, rendered as a plain table (snapshots, normalization, double render) |
| `load_table_reload` | The same component mounted once, `reload()` four times with unchanged data |
| `row_components` | 1000 small row components with no `on_load()` under one table, parent `render()` twice (per-instance construction and render overhead) |

A scenario is a directory with `.jqhtml` templates (and paired `.js` classes) plus
`bench.js`, which sets `window.jqhtml_bench = { name, run }`. `run()` should return
`window.bench_measure(async () => { ...one mount-and-ready cycle... })`, which does the
warm-up, ordering and sampling; the iteration count is rounded up to even. A scenario
that keeps state per runtime (one mounted component, say) keys it by `window.jqhtml`,
which is a different object for each of the three bundles.

## History

| Date | Change | Scenario | Result |
|---|---|---|---|
| 2026-09-14 | String-based `escape_html` (no `createElement` per value) | escape_heavy | -27% |
| 2026-09-14 | One `querySelectorAll` per pass instead of a `querySelector` per tracked element / component | tracked_elements, many_components, off_dom | -57%, -25%, -19% |
| 2026-09-14 | `uid()` without split/join; single-pass tag attribute build | all | within noise, reverted |
| 2026-09-14 | Native `setAttribute` instead of jQuery `attr()` in `apply_attributes` | tracked_elements | within noise, reverted |
| 2026-09-14 | Same two kept changes measured on Firefox 142 | escape_heavy, tracked_elements, many_components, off_dom, rerender | -27%, -34%, -15%, -14%, flat |
| 2026-09-14 | Same two kept changes measured on WebKit 26 | escape_heavy, tracked_elements, many_components, off_dom, rerender | -21%, -60%, -23%, -21%, flat |
| 2026-10-19 | One serialized `this.data` text per data generation; no render snapshots without `on_load()` (vs HEAD, Chromium) | load_table_boot, load_table_reload, row_components | -35%, -38%, -7% |
| 2026-10-19 | Per-class hierarchy and template-by-class caches, hoisted protection table, `_log_lifecycle` early return, one `.data()` write per element, `.call` per event, non-throwing cache-key decline (vs HEAD, Chromium, A/A control alongside) | all | within noise (row_components +0.9% vs A/A +0.1%, 9 rounds); kept as waste removal |
| 2026-10-19 | Default-attribute template chain memoized per template and class | row_components, many_components | within noise; dropped |
