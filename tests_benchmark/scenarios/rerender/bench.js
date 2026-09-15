// Mount once, then render() eight times: stop children, clear, rebuild, re-boot.
const items = Array.from({ length: 300 }, (_, i) => ({ i, label: `Card ${i}` }));
window.jqhtml_bench = {
  name: 'rerender (300 children x 4 render())',
  async run() {
    const host = $('<div>').appendTo('#app');
    const c = host.component('Bench_List', { items }).component();
    await c.ready();
    const ms = await window.bench_measure(async () => {
      for (let i = 0; i < 4; i++) await c.render();
    }, { warmup: 2, iterations: 10 });
    host.remove();
    return ms;
  },
};
