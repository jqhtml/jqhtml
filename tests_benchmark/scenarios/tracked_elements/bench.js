// 500 rows, each with three tracked elements ($sid / @click / data-*): exercises
// the post-innerHTML lookup and attribute application passes.
const items = Array.from({ length: 1200 }, (_, i) => ({ i, label: `Item ${i}` }));
window.jqhtml_bench = {
  name: 'tracked_elements (3600 $sid/@click elements)',
  run() {
    return window.bench_measure(async () => {
      const host = $('<div>').appendTo('#app');
      const c = host.component('Bench_Tracked', { items }).component();
      await c.ready();
      host.remove();
    });
  },
};
