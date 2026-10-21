// Unit tests for the benchmark method (tests_benchmark/method.cjs).
// Run: node --test tests_benchmark/test/method.test.cjs
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { mulberry32, iteration_orders, install_jquery_restore, paired_change, bootstrap_interval } = require('../method.cjs');

const ROOT = path.join(__dirname, '..', '..');

// How often `a` runs before `b` over a list of orders.
const before_count = (orders, a, b) => orders.filter((o) => o.indexOf(a) < o.indexOf(b)).length;

test('iteration_orders: every side runs before and after every other side equally often', () => {
  for (const variants of [['baseline', 'current'], ['baseline', 'baseline_aa', 'current']]) {
    for (const iterations of [10, 12, 21]) {
      const orders = iteration_orders(variants, iterations, mulberry32(7));
      assert.strictEqual(orders.length, iterations + (iterations % 2));
      for (const a of variants) for (const b of variants) {
        if (a !== b) assert.strictEqual(before_count(orders, a, b), orders.length / 2, `${a} before ${b}, ${variants.length} sides, ${iterations} iterations`);
      }
    }
  }
});

test('iteration_orders: the same seed gives the same orders', () => {
  const v = ['baseline', 'baseline_aa', 'current'];
  assert.deepStrictEqual(iteration_orders(v, 21, mulberry32(42)), iteration_orders(v, 21, mulberry32(42)));
  assert.notDeepStrictEqual(iteration_orders(v, 21, mulberry32(42)), iteration_orders(v, 21, mulberry32(43)));
});

// Synthetic samples: every side costs `base` ms (times `factor` for current), and the
// side that runs second in an iteration pays `penalty` more - the position effect the
// old harness had. 11 iterations baseline-first, 10 current-first, as with the old
// fixed alternation over 21 iterations.
function synthetic({ factor = 1, penalty = 0.03 } = {}) {
  const iters = [];
  for (let i = 0; i < 21; i++) {
    const order = i % 2 ? ['current', 'baseline'] : ['baseline', 'current'];
    const samples = {};
    order.forEach((v, pos) => { samples[v] = 10 * (v === 'current' ? factor : 1) * (pos ? 1 + penalty : 1); });
    iters.push({ order, samples });
  }
  return iters;
}

test('paired_change: a position effect does not bias identical code', () => {
  assert.ok(Math.abs(paired_change(synthetic(), 'current')) < 0.01, `got ${paired_change(synthetic(), 'current')}%`);
});

test('paired_change: a real difference is reported through a position effect', () => {
  const got = paired_change(synthetic({ factor: 0.95 }), 'current');
  assert.ok(Math.abs(got - -5) < 0.01, `got ${got}%`);
});

test('bootstrap_interval: brackets the estimate, and is zero-width without noise', () => {
  const [lo, hi] = bootstrap_interval(synthetic(), 'current', mulberry32(1), 200);
  assert.ok(Math.abs(lo) < 0.01 && Math.abs(hi) < 0.01, `got ${lo}..${hi}`);
  const rand = mulberry32(3);
  const noisy = synthetic().map((it) => ({ order: it.order, samples: { baseline: it.samples.baseline * (1 + (rand() - 0.5) / 10), current: it.samples.current * (1 + (rand() - 0.5) / 10) } }));
  const est = paired_change(noisy, 'current');
  const [nlo, nhi] = bootstrap_interval(noisy, 'current', mulberry32(1), 200);
  assert.ok(nlo < est && est < nhi && nhi - nlo > 0.5, `got ${nlo}..${nhi} around ${est}`);
});

// Two jqhtml runtimes taking turns on one jQuery, as in the benchmark page.
// cleanData_layers() counts how many jqhtml cleanData wrappers one call passes through.
test('install_jquery_restore: switching runtimes keeps one layer of jQuery wrappers', async () => {
  const { JSDOM } = require(path.join(ROOT, 'node_modules', 'jsdom'));
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  // With a global window/document jquery exports jQuery itself, else a factory.
  const jq = require(path.join(ROOT, 'node_modules', 'jquery'));
  const $ = jq.fn ? jq : jq(dom.window);
  dom.window.jQuery = dom.window.$ = $;
  const guid_before = $.guid;
  const html_before = $.fn.html;
  install_jquery_restore(dom.window);

  const core_url = pathToFileURL(path.join(ROOT, 'packages', 'core', 'dist', 'jqhtml-core.esm.js')).href;
  const runtimes = [];
  for (const copy of ['a', 'b']) {
    dom.window.bench_restore_jquery();
    runtimes.push(await import(`${core_url}?runtime=${copy}`));   // each import is its own module instance
  }
  const cleanData_layers = () => {
    let n = 0;
    $.cleanData([{ nodeType: 1, classList: { contains() { n++; return false; } } }]);
    return n;
  };

  for (let i = 0; i < 6; i++) {
    dom.window.bench_restore_jquery();
    runtimes[i % 2].init($);
    assert.strictEqual(cleanData_layers(), 1, `switch ${i}`);
    assert.strictEqual(typeof $.fn.component, 'function');
  }
  dom.window.bench_restore_jquery();
  assert.strictEqual(cleanData_layers(), 0, 'restore leaves no jqhtml wrapper');
  assert.strictEqual($.fn.html, html_before);
  assert.strictEqual($.fn.component, undefined);
  assert.strictEqual(dom.window.jQuery, $);
  $('<div>').on('click', () => {});
  assert.ok($.guid > guid_before, 'jQuery.guid is a counter, not restored');

  // Without the restore every switch adds a layer - what the old harness did.
  for (let i = 0; i < 4; i++) runtimes[i % 2].init($);
  assert.strictEqual(cleanData_layers(), 4);
  dom.window.close();
});
