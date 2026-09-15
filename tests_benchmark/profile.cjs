#!/usr/bin/env node
/**
 * CPU-profile one benchmark scenario on the CURRENT runtime and print the
 * functions with the most self time. A companion to run.cjs for finding
 * where a scenario's time actually goes.
 *
 *   node tests_benchmark/profile.cjs rerender [--top=25]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const HARNESS = path.join(__dirname, '..', 'jqhtml-render-harness');
const webpack = require(path.join(HARNESS, 'node_modules', 'webpack'));
const { chromium } = require(path.join(HARNESS, 'node_modules', 'playwright'));
const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
const scenario = args.find((a) => !a.startsWith('--'));
const top = Number((args.find((a) => a.startsWith('--top=')) || '--top=25').split('=')[1]);
if (!scenario) { console.error('usage: profile.cjs <scenario>'); process.exit(2); }
const dir = path.join(__dirname, 'scenarios', scenario);
const OUT = fs.mkdtempSync('/tmp/jqhtml_prof_');
const compiler = path.join(ROOT, 'packages', 'parser', 'bin', 'jqhtml-compile');

async function main() {
  const compiled = fs.readdirSync(dir).filter((f) => f.endsWith('.jqhtml')).sort().map((f) => {
    const out = path.join(OUT, `${f}.js`);
    execSync(`node "${compiler}" "${path.join(dir, f)}" > "${out}"`);
    const code = fs.readFileSync(out, 'utf8');
    const js = path.join(dir, f.replace(/\.jqhtml$/, '.js'));
    return { code, js: fs.existsSync(js) ? fs.readFileSync(js, 'utf8') : null, name: (code.match(/name:\s*['"]([^'"]+)['"]/) || [])[1] };
  });
  const entry = path.join(OUT, 'entry.js');
  fs.writeFileSync(entry, `
import jqhtml, { Jqhtml_Component } from '@jqhtml/core';
window.jqhtml = jqhtml; window.Jqhtml_Component = Jqhtml_Component;
${compiled.map((t) => `${t.js ? `${t.js}\njqhtml.register_component('${t.name}', ${t.name});` : ''}
${t.code.replace(/^export\s*\{[^}]*\};?\s*$/m, '')}
jqhtml.register_template(template_${t.name});`).join('\n')}
window.bench_measure = async (fn, { iterations = 12 } = {}) => { for (let i = 0; i < iterations; i++) await fn(); return []; };
${fs.readFileSync(path.join(dir, 'bench.js'), 'utf8')}
window.bench_ready = true;
`);
  await new Promise((resolve, reject) => webpack({
    mode: 'development', devtool: false, entry, output: { path: OUT, filename: 'bundle.js' },
    resolve: { alias: { '@jqhtml/core': path.join(ROOT, 'packages', 'core', 'dist', 'jqhtml-core.esm.js') } },
    externals: { jquery: 'jQuery' },
  }, (err, stats) => (err || stats.hasErrors()) ? reject(err || new Error(stats.toString('errors-only'))) : resolve()));
  fs.copyFileSync(path.join(ROOT, 'node_modules', 'jquery', 'dist', 'jquery.min.js'), path.join(OUT, 'jquery.min.js'));
  fs.writeFileSync(path.join(OUT, 'page.html'), `<!DOCTYPE html><html><body><div id="app"></div><script src="jquery.min.js"></script><script src="bundle.js"></script></body></html>`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('file://' + path.join(OUT, 'page.html'));
  await page.waitForFunction(() => window.bench_ready);
  await page.evaluate(() => window.jqhtml_bench.run());   // warm-up
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  await cdp.send('Profiler.start');
  await page.evaluate(() => window.jqhtml_bench.run());
  const { profile } = await cdp.send('Profiler.stop');
  await browser.close();

  // Aggregate self time per function
  const by_id = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const dt = profile.timeDeltas;
  let total = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const node = by_id.get(profile.samples[i]);
    const cf = node.callFrame;
    const file = cf.url ? path.basename(cf.url) : '';
    const key = `${cf.functionName || '(anonymous)'}  ${file}:${cf.lineNumber + 1}`;
    const t = (dt[i] || 0) / 1000;
    self.set(key, (self.get(key) || 0) + t);
    total += t;
  }
  const rows = [...self.entries()].filter(([k]) => !/^\(garbage collector\)|^\(program\)|^\(idle\)|^\(root\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, top);
  console.log(`scenario ${scenario}: ${total.toFixed(0)} ms sampled (self time, top ${top})\n`);
  for (const [k, t] of rows) console.log(`${t.toFixed(1).padStart(8)} ms ${(100 * t / total).toFixed(1).padStart(6)}%  ${k}`);
  fs.rmSync(OUT, { recursive: true, force: true });
}
main().catch((e) => { console.error(e); process.exit(1); });
