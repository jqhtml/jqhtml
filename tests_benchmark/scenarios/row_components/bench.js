// 1000 small row components (no on_load anywhere) under one table, parent
// render() twice per iteration: stop 1000 children, rebuild, construct and boot
// 1000 row components. Stresses per-instance construction and render overhead.
const rows = Array.from({ length: 1000 }, (_, i) => ({
  id: i, name: `Name ${i}`, email: `user${i}@example.com`, city: `City ${i % 50}`,
  status: i % 3 ? 'active' : 'inactive', amount: (i * 13.37).toFixed(2), date: `2026-10-${10 + (i % 18)}`, note: 'stable',
}));
window.jqhtml_bench = {
  name: 'row_components (1000 rows, 2 parent render())',
  async run() {
    const hosts = new Map();  // keyed by the active runtime's jqhtml object
    const ms = await window.bench_measure(async () => {
      // One mounted component per runtime: bench_measure alternates runtimes, and a
      // component belongs to the runtime that created it.
      if (!hosts.has(window.jqhtml)) {
        const host = $('<div>').appendTo('#app');
        hosts.set(window.jqhtml, host.component('Bench_Rows', { rows }).component());
        await hosts.get(window.jqhtml).ready();
      }
      for (let i = 0; i < 2; i++) await hosts.get(window.jqhtml).render();
    }, { warmup: 2, iterations: 12 });
    $('#app').empty();
    return ms;
  },
};
