#!/usr/bin/env node
/**
 * jqhtml render benchmarks: current working tree vs a pinned baseline build.
 *
 *   node tests_benchmark/run.cjs                     # every scenario
 *   node tests_benchmark/run.cjs escape_heavy        # one scenario
 *   node tests_benchmark/run.cjs --rounds=9          # more pages per scenario (default 5)
 *   node tests_benchmark/run.cjs --browser=firefox   # another engine (chromium default; webkit too)
 *   node tests_benchmark/run.cjs --baseline=HEAD     # compare against another commit's build
 *   node tests_benchmark/run.cjs --seed=1234         # replay the run order of an earlier run
 *   node tests_benchmark/run.cjs --no-aa             # skip the A/A control (about 5 min instead of 9)
 *
 * "With and without the optimization" is realised as bundles of the SAME
 * scenario loaded into ONE page: `baseline` uses @jqhtml/core as built at the
 * commit in BASELINE_COMMIT (read straight from git, no checkout), `current`
 * uses packages/core/dist, and `baseline_aa` is a second, independent bundle of
 * the baseline (its own copy of the runtime) that serves as the A/A control:
 * baseline against itself, measured exactly like current against baseline, so
 * its result is the noise floor of that page.
 *
 * Equal conditions for every side:
 *   - The page's jQuery is restored to its pristine state before each bundle loads
 *     and before every switch of runtime. jqhtml's init() wraps jQuery.fn.html/
 *     on/find/val and jQuery.cleanData; without the restore every switch stacked
 *     one more wrapper layer (45 by the end of a 21-iteration page), so the side
 *     that ran second in a pair always paid one more layer than the side that ran
 *     first, and every sample was slower than the one before it.
 *   - The bundle load order, the warm-up order and the order within every
 *     iteration come from a seeded PRNG (printed; --seed=N replays it). Each
 *     random order is followed by its reverse, so every side runs before and
 *     after every other side equally often.
 *   - The change is estimated per position: the median paired ratio over the
 *     iterations where the side ran before baseline, and over those where it ran
 *     after, combined by geometric mean. Any effect of position cancels, whatever
 *     the counts. (The old estimator, one median over all pairs with 11 pairs in
 *     one order and 10 in the other, landed in whichever mode had the majority.)
 *
 * The A/A spread is the 95% bootstrap interval of the A/A change. A scenario
 * reports PASS when current is at least THRESHOLD faster than baseline AND the
 * change lies outside that spread, SLOWER for the same beyond +THRESHOLD, NOISE
 * when it passes THRESHOLD but lies within the spread, FLAT otherwise. A change
 * within the spread is marked "n.s." (not significant).
 *
 * The method itself (orders, jQuery restore, estimator, interval) lives in
 * method.cjs and is unit-tested by test/method.test.cjs.
 *
 * Each scenario directory holds .jqhtml templates plus bench.js, which defines
 * window.jqhtml_bench = { name, run: async () => samples }. Each bundle's
 * templates are compiled by the parser of the same commit as its runtime: the
 * compiled template format is a contract between parser and core, which ship in
 * lockstep, so a baseline runtime cannot run templates from a newer parser.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const HARNESS = path.join(__dirname, '..', 'jqhtml-render-harness');
const webpack = require(path.join(HARNESS, 'node_modules', 'webpack'));
const playwright = require(path.join(HARNESS, 'node_modules', 'playwright'));
const { mulberry32, shuffled, iteration_orders, install_jquery_restore, median, paired_change, bootstrap_interval } = require('./method.cjs');

const ROOT = path.join(__dirname, '..');
const THRESHOLD = 3; // percent
const args = process.argv.slice(2);
const arg = (name, fallback) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : fallback; };
const rounds = Number(arg('rounds', '5'));
const only = args.filter((a) => !a.startsWith('--'));
// --browser=chromium|firefox|webkit (default chromium). Same scenarios, same
// method; a second engine tells us whether a win is the engine's or ours.
const browser_name = arg('browser', 'chromium');
if (!playwright[browser_name]) { console.error(`--browser must be chromium, firefox or webkit (got ${browser_name})`); process.exit(2); }
// --baseline=<commit> overrides BASELINE_COMMIT for one run, e.g. --baseline=HEAD to
// measure uncommitted work against the last commit rather than the last release.
const baseline_commit = arg('baseline', '') || fs.readFileSync(path.join(__dirname, 'BASELINE_COMMIT'), 'utf8').trim();
// --seed=N fixes every random order of the run (printed in the header).
const seed = Number(arg('seed', String(Math.floor(Math.random() * 0x7fffffff)))) >>> 0;
// --no-aa skips the A/A control: two sides per iteration instead of three.
const with_aa = !args.includes('--no-aa');
const VARIANTS = with_aa ? ['baseline', 'baseline_aa', 'current'] : ['baseline', 'current'];

const OUT = fs.mkdtempSync('/tmp/jqhtml_bench_');
const compiler = path.join(ROOT, 'packages', 'parser', 'bin', 'jqhtml-compile');

// The baseline commit's parser, read straight from git like its runtime. It resolves
// its one dependency (source-map) through a link to the working tree's node_modules.
function baseline_compiler() {
  const dir = path.join(OUT, 'parser-baseline');
  fs.mkdirSync(dir);
  execSync(`git -C "${ROOT}" archive ${baseline_commit} packages/parser/dist packages/parser/bin packages/parser/package.json | tar -x -C "${dir}"`);
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'packages', 'parser', 'node_modules'));
  return path.join(dir, 'packages', 'parser', 'bin', 'jqhtml-compile');
}

function core_variants() {
  const baseline = path.join(OUT, 'core-baseline.js');
  fs.writeFileSync(baseline, execSync(`git -C "${ROOT}" show ${baseline_commit}:packages/core/dist/jqhtml-core.esm.js`, { maxBuffer: 64 * 1024 * 1024 }));
  return {
    baseline,
    baseline_aa: baseline,
    current: path.join(ROOT, 'packages', 'core', 'dist', 'jqhtml-core.esm.js'),
  };
}

function compile_scenario(dir, compiler, variant) {
  const templates = fs.readdirSync(dir).filter((f) => f.endsWith('.jqhtml')).sort();
  return templates.map((f) => {
    const out = path.join(OUT, `${path.basename(dir)}_${variant}_${f}.js`);
    execSync(`node "${compiler}" "${path.join(dir, f)}" > "${out}"`);
    const code = fs.readFileSync(out, 'utf8');
    const js = path.join(dir, f.replace(/\.jqhtml$/, '.js'));
    return { code, js: fs.existsSync(js) ? fs.readFileSync(js, 'utf8') : null, name: (code.match(/name:\s*['"]([^'"]+)['"]/) || [])[1] };
  });
}

function write_entry(scenario, compiled, variant) {
  // One bundle per side. Each registers the scenario's templates and JS classes
  // against ITS OWN copy of core and exposes activate(), which makes it the
  // runtime behind $.fn.component for the next iteration.
  const entry = `
import jqhtml, { Jqhtml_Component, init } from '@jqhtml/core';
${compiled.map((t) => `
${t.js ? `${t.js}\njqhtml.register_component('${t.name}', ${t.name});` : ''}
${t.code.replace(/^export\s*\{[^}]*\};?\s*$/m, '')}
jqhtml.register_template(template_${t.name});
`).join('\n')}
window.JQHTML_VARIANTS = window.JQHTML_VARIANTS || {};
window.JQHTML_VARIANTS['${variant}'] = {
  activate() {
    window.bench_restore_jquery();   // drop the previous side's jQuery wrappers
    init(window.__pristine_jquery);  // and install this side's, one layer, as in production
    window.jqhtml = jqhtml;
    window.Jqhtml_Component = Jqhtml_Component;
  },
};
`;
  const file = path.join(OUT, `${path.basename(scenario)}-${variant}.entry.js`);
  fs.writeFileSync(file, entry);
  return file;
}

function write_page(name, scenario, bundles, load_order, round) {
  // All bundles on one page, loaded in this round's seeded order. bench_measure
  // runs every side once per iteration, in a seeded order followed next
  // iteration by its reverse, so the sample sets see the same machine load, JIT
  // state and GC pressure, and each side runs in each position equally often.
  const bench = fs.readFileSync(path.join(scenario, 'bench.js'), 'utf8');
  const html = path.join(OUT, `${name}-r${round}.html`);
  fs.writeFileSync(html, `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div id="app"></div>
<script src="jquery.min.js"></script>
<script>
// Snapshot jQuery before any runtime touches it (method.cjs install_jquery_restore).
(${install_jquery_restore})(window);
</script>
${load_order.map((v) => `<script>window.bench_restore_jquery();</script>\n<script src="${path.basename(bundles[v])}"></script>`).join('\n')}
<script>
const iteration_orders = ${iteration_orders};
window.bench_measure = async function (fn, { warmup = 3, iterations = 21 } = {}) {
  const rand = (${mulberry32})(window.__bench_seed);
  const variants = window.__bench_variants;
  for (const v of iteration_orders(variants, 1, rand)[0]) { window.JQHTML_VARIANTS[v].activate(); for (let i = 0; i < warmup; i++) await fn(); }
  const orders = iteration_orders(variants, iterations, rand);   // a random order, then its reverse, ...
  const samples = {};
  for (const v of variants) samples[v] = [];
  for (const order of orders) {
    for (const v of order) {
      window.JQHTML_VARIANTS[v].activate();
      if (window.gc) window.gc();
      await new Promise((r) => setTimeout(r, 0));
      const t0 = performance.now();
      await fn();
      samples[v].push(performance.now() - t0);
    }
  }
  return { samples, orders };
};
</script>
<script>${bench}
window.bench_ready = true;</script>
</body></html>`);
  return 'file://' + html;
}

function bundle(entry, core, out_name) {
  return new Promise((resolve, reject) => {
    webpack({
      mode: 'development',
      devtool: false,
      entry,
      output: { path: OUT, filename: out_name },
      resolve: { alias: { '@jqhtml/core': core } },
      externals: { jquery: 'jQuery' },
    }, (err, stats) => {
      if (err || stats.hasErrors()) return reject(err || new Error(stats.toString('errors-only')));
      resolve(path.join(OUT, out_name));
    });
  });
}

const pct = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`;

async function main() {
  const started = Date.now();
  const cores = core_variants();
  const base_compiler = baseline_compiler();
  const compilers = { baseline: base_compiler, baseline_aa: base_compiler, current: compiler };
  fs.copyFileSync(path.join(ROOT, 'node_modules', 'jquery', 'dist', 'jquery.min.js'), path.join(OUT, 'jquery.min.js'));
  const scenario_dirs = fs.readdirSync(path.join(__dirname, 'scenarios'))
    .filter((d) => only.length === 0 || only.includes(d))
    .map((d) => path.join(__dirname, 'scenarios', d))
    .filter((d) => fs.existsSync(path.join(d, 'bench.js')));
  if (!scenario_dirs.length) { console.error('no scenarios matched'); process.exit(2); }

  console.log(`engine: ${browser_name}   baseline: @jqhtml/core at ${baseline_commit}   current: packages/core/dist   rounds: ${rounds}   A/A: ${with_aa ? 'on' : 'off'}   seed: ${seed}\n`);
  // --expose-gc is a V8 flag; other engines have no window.gc and bench_measure skips it.
  const browser = await playwright[browser_name].launch({ headless: true, args: browser_name === 'chromium' ? ['--js-flags=--expose-gc'] : [] });
  const rand = mulberry32(seed);
  const results = [];

  for (const dir of scenario_dirs) {
    const name = path.basename(dir);
    const bundles = {};
    for (const variant of VARIANTS) {
      const compiled = compile_scenario(dir, compilers[variant], variant);
      bundles[variant] = await bundle(write_entry(dir, compiled, variant), cores[variant], `${name}-${variant}.bundle.js`);
    }

    const times = Object.fromEntries(VARIANTS.map((v) => [v, []]));
    const iters = [];
    let bench_name = name;
    for (let r = 0; r < rounds; r++) {
      // A fresh page (and browser context) per round, with its own seeded bundle order.
      const url = write_page(name, dir, bundles, shuffled(VARIANTS, rand), r);
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(url);
      await page.waitForFunction(() => window.bench_ready, { timeout: 15000 });
      const result = await page.evaluate(async ({ page_seed, variants }) => {
        window.__bench_seed = page_seed;
        window.__bench_variants = variants;
        const bench = window.jqhtml_bench;
        return { name: bench.name, ...(await bench.run()) };
      }, { page_seed: Math.floor(rand() * 0x7fffffff), variants: VARIANTS });
      await page.close();
      if (errors.length) { console.error(`  ${name} errors:\n    ${errors.join('\n    ')}`); process.exitCode = 1; }
      bench_name = result.name || name;
      const round_iters = result.orders.map((order, i) => ({ order, samples: Object.fromEntries(VARIANTS.map((v) => [v, result.samples[v][i]])) }));
      for (const v of VARIANTS) times[v].push(...result.samples[v]);
      iters.push(...round_iters);
    }
    const b = median(times.baseline), c = median(times.current);
    const delta = paired_change(iters, 'current');
    let aa = null, aa_lo = null, aa_hi = null, noise = 0;
    if (with_aa) {
      aa = paired_change(iters, 'baseline_aa');
      [aa_lo, aa_hi] = bootstrap_interval(iters, 'baseline_aa', rand);
      noise = Math.max(Math.abs(aa_lo), Math.abs(aa_hi));
    }
    const significant = Math.abs(delta) > noise;
    const verdict = Math.abs(delta) < THRESHOLD ? 'FLAT' : !significant ? 'NOISE' : delta < 0 ? 'PASS' : 'SLOWER';
    const iqr = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length * 0.75)] - s[Math.floor(s.length * 0.25)]; };
    results.push({ name: bench_name, b, c, delta, significant, aa, aa_lo, aa_hi, verdict, n: times.baseline.length, spread_b: iqr(times.baseline), spread_c: iqr(times.current) });
  }
  await browser.close();

  console.log('scenario'.padEnd(46) + 'baseline ms'.padStart(12) + 'current ms'.padStart(11) + 'A/B change'.padStart(15) + 'A/A'.padStart(8) + '  A/A 95% range  ' + 'verdict  n    IQR b / c');
  for (const r of results) {
    const ab = pct(r.delta) + (with_aa && !r.significant ? ' n.s.' : '');
    const aa = with_aa ? pct(r.aa) : '-';
    const range = with_aa ? `${pct(r.aa_lo)}..${pct(r.aa_hi)}` : '-';
    console.log(r.name.padEnd(46) + r.b.toFixed(1).padStart(12) + r.c.toFixed(1).padStart(11) + ab.padStart(15) + aa.padStart(8) + `  ${range.padEnd(14)}  ${r.verdict.padEnd(7)} ${String(r.n).padStart(3)}  ${r.spread_b.toFixed(1)} / ${r.spread_c.toFixed(1)}`);
  }
  console.log(`\nengine ${browser_name}; change = per-position median paired ratio vs baseline (all sides in one page, seeded order + reverse), ${rounds} pages, seed ${seed}.`);
  if (with_aa) console.log(`A/A = a second bundle of the baseline measured the same way; A/A 95% range = bootstrap interval of that estimate; n.s. = A/B change inside it (|A/B| <= its larger end).`);
  console.log(`PASS = current at least ${THRESHOLD}% faster${with_aa ? ' and outside the A/A spread; NOISE = past ' + THRESHOLD + '% but within it' : ''}.   ${((Date.now() - started) / 1000).toFixed(0)}s`);
  fs.rmSync(OUT, { recursive: true, force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });
