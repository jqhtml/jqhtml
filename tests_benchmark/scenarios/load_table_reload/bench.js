// Mount once, then reload() four times: on_load() returns the same 1000 rows x 8
// fields each time, so this is the before/after comparison, the normalization of
// the result and the re-render a reload() always does.
window.bench_rows = () => Array.from({ length: 1000 }, (_, i) => ({
  id: i, name: `Name ${i}`, email: `user${i}@example.com`, city: `City ${i % 50}`,
  status: i % 3 ? 'active' : 'inactive', amount: (i * 13.37).toFixed(2), date: `2026-10-${10 + (i % 18)}`, note: 'stable',
}));
window.jqhtml_bench = {
  name: 'load_table_reload (on_load 1000x8, 4 reload())',
  async run() {
    const hosts = new Map();  // keyed by the active runtime's jqhtml object
    const ms = await window.bench_measure(async () => {
      // One mounted component per runtime: bench_measure alternates runtimes, and a
      // component belongs to the runtime that created it.
      if (!hosts.has(window.jqhtml)) {
        const host = $('<div>').appendTo('#app');
        hosts.set(window.jqhtml, host.component('Bench_Table', {}).component());
        await hosts.get(window.jqhtml).ready();
      }
      for (let i = 0; i < 4; i++) await hosts.get(window.jqhtml).reload();
    }, { warmup: 2, iterations: 12 });
    $('#app').empty();
    return ms;
  },
};
