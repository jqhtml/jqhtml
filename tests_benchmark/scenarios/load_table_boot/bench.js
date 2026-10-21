// A component whose on_load() returns 1000 rows x 8 fields, rendered as a plain
// table: the double render plus every snapshot/serialization of this.data the
// load path takes. One iteration = mount, load, re-render, ready.
window.bench_rows = () => Array.from({ length: 1000 }, (_, i) => ({
  id: i, name: `Name ${i}`, email: `user${i}@example.com`, city: `City ${i % 50}`,
  status: i % 3 ? 'active' : 'inactive', amount: (i * 13.37).toFixed(2), date: `2026-10-${10 + (i % 18)}`, note: 'stable',
}));
window.jqhtml_bench = {
  name: 'load_table_boot (on_load 1000x8, boot)',
  run() {
    return window.bench_measure(async () => {
      const host = $('<div>').appendTo('#app');
      const c = host.component('Bench_Table', {}).component();
      await c.ready();
      host.remove();
    });
  },
};
