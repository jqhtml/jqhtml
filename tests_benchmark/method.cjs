/**
 * The measurement method of run.cjs, kept apart so it can be unit-tested
 * (tests_benchmark/test/method.test.cjs). The page-side functions here
 * (mulberry32, iteration_orders, install_jquery_restore) are injected into the
 * benchmark page with Function.prototype.toString, so each must be
 * self-contained: no references to anything outside its own body.
 */

// Small seeded PRNG: returns a function giving floats in [0, 1).
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates with a supplied random source.
function shuffled(xs, rand) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// The run order of every side for each iteration: a random order, then its reverse,
// and so on. Rounds the count up to even, so across the list every side runs before
// and after every other side exactly equally often.
function iteration_orders(variants, iterations, rand) {
  const orders = [];
  for (let i = 0; i < iterations + (iterations % 2); i++) {
    if (i % 2) { orders.push([...orders[i - 1]].reverse()); continue; }
    const a = [...variants];
    for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; }
    orders.push(a);
  }
  return orders;
}

// Snapshot the page's jQuery before any jqhtml runtime touches it, and define
// win.bench_restore_jquery() to return it to that state. jqhtml's init() wraps
// jQuery.fn.html/on/find/val/init/append... and jQuery.cleanData around whatever
// is there; with several runtimes taking turns on one jQuery, every switch would
// stack another layer. The restore puts back every jQuery.fn member and every
// function-valued static, drops whatever a runtime added, leaves data counters
// such as jQuery.guid alone, and points window.jQuery / window.$ back at it.
function install_jquery_restore(win) {
  const $ = win.jQuery;
  const fn_snapshot = Object.getOwnPropertyNames($.fn).map((k) => [k, Object.getOwnPropertyDescriptor($.fn, k)]);
  const fn_keys = new Set(fn_snapshot.map(([k]) => k));
  const static_snapshot = Object.getOwnPropertyNames($).filter((k) => typeof $[k] === 'function').map((k) => [k, $[k]]);
  const static_keys = new Set(Object.getOwnPropertyNames($));
  win.__pristine_jquery = $;
  win.bench_restore_jquery = function () {
    for (const k of Object.getOwnPropertyNames($.fn)) if (!fn_keys.has(k)) delete $.fn[k];
    for (const [k, d] of fn_snapshot) Object.defineProperty($.fn, k, d);
    for (const k of Object.getOwnPropertyNames($)) if (!static_keys.has(k)) delete $[k];
    for (const [k, v] of static_snapshot) $[k] = v;
    win.jQuery = win.$ = $;
  };
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Change of `side` against baseline, in percent, from paired samples
// (iters = [{ order: [...], samples: { baseline: ms, <side>: ms } }]). Pairs are
// split by whether `side` ran before or after baseline in that iteration; the
// change is the geometric mean of the two medians, so an effect of position
// (running first or second) cancels whatever the counts in each group.
function paired_change(iters, side) {
  const before = [], after = [];
  for (const it of iters) {
    const ratio = it.samples[side] / it.samples.baseline;
    (it.order.indexOf(side) < it.order.indexOf('baseline') ? before : after).push(ratio);
  }
  const strata = [before, after].filter((s) => s.length).map(median);
  return (Math.exp(strata.reduce((a, r) => a + Math.log(r), 0) / strata.length) - 1) * 100;
}

// 95% bootstrap interval of paired_change(iters, side): resample the iterations
// with replacement and take the 2.5th and 97.5th percentiles of the estimate.
function bootstrap_interval(iters, side, rand, reps = 1000) {
  const estimates = [];
  for (let r = 0; r < reps; r++) {
    const sample = [];
    for (let i = 0; i < iters.length; i++) sample.push(iters[Math.floor(rand() * iters.length)]);
    estimates.push(paired_change(sample, side));
  }
  estimates.sort((a, b) => a - b);
  return [estimates[Math.floor(reps * 0.025)], estimates[Math.ceil(reps * 0.975) - 1]];
}

module.exports = { mulberry32, shuffled, iteration_orders, install_jquery_restore, median, paired_change, bootstrap_interval };
