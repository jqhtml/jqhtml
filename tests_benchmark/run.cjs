#!/usr/bin/env node
/**
 * jqhtml render benchmarks: current working tree vs a pinned baseline build.
 *
 *   node tests_benchmark/run.cjs                     # every scenario
 *   node tests_benchmark/run.cjs escape_heavy        # one scenario
 *   node tests_benchmark/run.cjs --rounds=9          # more pages per scenario (default 5)
 *   node tests_benchmark/run.cjs --browser=firefox   # another engine (chromium default; webkit too)
 *
 * "With and without the optimization" is realised as two bundles of the SAME
 * scenario loaded into ONE page: `baseline` uses @jqhtml/core as built at the
 * commit in BASELINE_COMMIT (read straight from git, no checkout), `current`
 * uses packages/core/dist. bench_measure alternates which runtime is active
 * for each iteration, so both sample sets see the same machine load and JIT
 * state, and the change is the median of per-iteration paired ratios. A
 * scenario reports PASS when current is at least THRESHOLD faster than
 * baseline, FLAT within +/-THRESHOLD, and SLOWER beyond it.
 *
 * Each scenario directory holds .jqhtml templates plus bench.js, which defines
 * window.jqhtml_bench = { name, run: async () => samples }. The parser used to
 * compile templates is always the working tree's - only the runtime differs
 * between the two bundles.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const HARNESS = path.join(__dirname, '..', 'jqhtml-render-harness');
const webpack = require(path.join(HARNESS, 'node_modules', 'webpack'));
const playwright = require(path.join(HARNESS, 'node_modules', 'playwright'));

const ROOT = path.join(__dirname, '..');
const THRESHOLD = 3; // percent
const args = process.argv.slice(2);
const rounds = Number((args.find((a) => a.startsWith('--rounds=')) || '--rounds=5').split('=')[1]);
const only = args.filter((a) => !a.startsWith('--'));
// --browser=chromium|firefox|webkit (default chromium). Same scenarios, same
// method; a second engine tells us whether a win is the engine's or ours.
const browser_name = (args.find((a) => a.startsWith('--browser=')) || '--browser=chromium').split('=')[1];
if (!playwright[browser_name]) { console.error(`--browser must be chromium, firefox or webkit (got ${browser_name})`); process.exit(2); }
const baseline_commit = fs.readFileSync(path.join(__dirname, 'BASELINE_COMMIT'), 'utf8').trim();

const OUT = fs.mkdtempSync('/tmp/jqhtml_bench_');
const compiler = path.join(ROOT, 'packages', 'parser', 'bin', 'jqhtml-compile');

function core_variants() {
  const baseline = path.join(OUT, 'core-baseline.js');
  fs.writeFileSync(baseline, execSync(`git -C "${ROOT}" show ${baseline_commit}:packages/core/dist/jqhtml-core.esm.js`, { maxBuffer: 64 * 1024 * 1024 }));
  return {
    baseline,
    current: path.join(ROOT, 'packages', 'core', 'dist', 'jqhtml-core.esm.js'),
  };
}

function compile_scenario(dir) {
  const templates = fs.readdirSync(dir).filter((f) => f.endsWith('.jqhtml')).sort();
  return templates.map((f) => {
    const out = path.join(OUT, `${path.basename(dir)}_${f}.js`);
    execSync(`node "${compiler}" "${path.join(dir, f)}" > "${out}"`);
    const code = fs.readFileSync(out, 'utf8');
    const js = path.join(dir, f.replace(/\.jqhtml$/, '.js'));
    return { code, js: fs.existsSync(js) ? fs.readFileSync(js, 'utf8') : null, name: (code.match(/name:\s*['"]([^'"]+)['"]/) || [])[1] };
  });
}

function write_entry(scenario, compiled, variant) {
  // One bundle per runtime. Each registers the scenario's templates and JS
  // classes against ITS OWN core and exposes activate(), which makes it the
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
    window.jQuery = window.$ = window.__pristine_jquery;
    init(window.__pristine_jquery);
    window.jqhtml = jqhtml;
    window.Jqhtml_Component = Jqhtml_Component;
  },
};
`;
  const file = path.join(OUT, `${path.basename(scenario)}-${variant}.entry.js`);
  fs.writeFileSync(file, entry);
  return file;
}

function write_page(name, scenario, bundles) {
  // Both bundles on one page. bench_measure alternates the active runtime per
  // iteration (order flipped each iteration), so the two sample sets see the
  // same machine load, JIT state and GC pressure; the paired ratio is robust
  // to the box being busy.
  const bench = fs.readFileSync(path.join(scenario, 'bench.js'), 'utf8');
  const html = path.join(OUT, `${name}.html`);
  fs.writeFileSync(html, `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div id="app"></div>
<script src="jquery.min.js"></script>
<script>window.__pristine_jquery = window.jQuery;</script>
<script src="${path.basename(bundles.baseline)}"></script>
<script src="${path.basename(bundles.current)}"></script>
<script>
window.bench_measure = async function (fn, { warmup = 3, iterations = 21 } = {}) {
  const variants = ['baseline', 'current'];
  for (const v of variants) { window.JQHTML_VARIANTS[v].activate(); for (let i = 0; i < warmup; i++) await fn(); }
  const samples = { baseline: [], current: [] };
  for (let i = 0; i < iterations; i++) {
    for (const v of i % 2 ? [...variants].reverse() : variants) {
      window.JQHTML_VARIANTS[v].activate();
      if (window.gc) window.gc();
      await new Promise((r) => setTimeout(r, 0));
      const t0 = performance.now();
      await fn();
      samples[v].push(performance.now() - t0);
    }
  }
  return samples;
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

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function main() {
  const cores = core_variants();
  fs.copyFileSync(path.join(ROOT, 'node_modules', 'jquery', 'dist', 'jquery.min.js'), path.join(OUT, 'jquery.min.js'));
  const scenario_dirs = fs.readdirSync(path.join(__dirname, 'scenarios'))
    .filter((d) => only.length === 0 || only.includes(d))
    .map((d) => path.join(__dirname, 'scenarios', d))
    .filter((d) => fs.existsSync(path.join(d, 'bench.js')));
  if (!scenario_dirs.length) { console.error('no scenarios matched'); process.exit(2); }

  console.log(`engine: ${browser_name}   baseline: @jqhtml/core at ${baseline_commit}   current: packages/core/dist   rounds: ${rounds}\n`);
  // --expose-gc is a V8 flag; other engines have no window.gc and bench_measure skips it.
  const browser = await playwright[browser_name].launch({ headless: true, args: browser_name === 'chromium' ? ['--js-flags=--expose-gc'] : [] });
  const results = [];

  for (const dir of scenario_dirs) {
    const name = path.basename(dir);
    const compiled = compile_scenario(dir);
    const bundles = {};
    for (const variant of ['baseline', 'current']) {
      bundles[variant] = await bundle(write_entry(dir, compiled, variant), cores[variant], `${name}-${variant}.bundle.js`);
    }
    const url = write_page(name, dir, bundles);

    const times = { baseline: [], current: [] };
    const pairs = [];
    let bench_name = name;
    for (let r = 0; r < rounds; r++) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(url);
      await page.waitForFunction(() => window.bench_ready, { timeout: 15000 });
      const result = await page.evaluate(async () => {
        const bench = window.jqhtml_bench;
        return { name: bench.name, samples: await bench.run() };
      });
      await page.close();
      if (errors.length) { console.error(`  ${name} errors:\n    ${errors.join('\n    ')}`); process.exitCode = 1; }
      bench_name = result.name || name;
      times.baseline.push(...result.samples.baseline);
      times.current.push(...result.samples.current);
      for (let i = 0; i < result.samples.baseline.length; i++) pairs.push(result.samples.current[i] / result.samples.baseline[i]);
    }
    const b = median(times.baseline), c = median(times.current);
    const delta = (median(pairs) - 1) * 100;   // median of per-iteration paired ratios
    const verdict = delta <= -THRESHOLD ? 'PASS' : delta >= THRESHOLD ? 'SLOWER' : 'FLAT';
    const iqr = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length * 0.75)] - s[Math.floor(s.length * 0.25)]; };
    results.push({ name: bench_name, b, c, delta, verdict, n: times.baseline.length, spread_b: iqr(times.baseline), spread_c: iqr(times.current) });
  }
  await browser.close();

  console.log('scenario'.padEnd(46) + 'baseline ms'.padStart(12) + 'current ms'.padStart(12) + 'change'.padStart(9) + '  verdict  n   IQR b / c');
  for (const r of results) {
    console.log(r.name.padEnd(46) + r.b.toFixed(1).padStart(12) + r.c.toFixed(1).padStart(12) + `${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(1)}%`.padStart(9) + `  ${r.verdict.padEnd(7)} ${String(r.n).padStart(3)}  ${r.spread_b.toFixed(1)} / ${r.spread_c.toFixed(1)}`);
  }
  console.log(`\nengine ${browser_name}; change = median of per-iteration paired ratios (both runtimes in one page, alternating), ${rounds} pages; PASS = current at least ${THRESHOLD}% faster.`);
  fs.rmSync(OUT, { recursive: true, force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });
