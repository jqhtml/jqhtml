// Same 400-child tree rendered on a detached element (the off-DOM child
// discovery path), then attached.
const items = Array.from({ length: 800 }, (_, i) => ({ i, label: `Card ${i}` }));
window.jqhtml_bench = {
  name: 'off_dom (800 children, detached mount)',
  run() {
    return window.bench_measure(async () => {
      const host = $('<div>');
      const c = host.component('Bench_List', { items }).component();
      await c.ready();
      host.appendTo('#app');
      host.remove();
    });
  },
};
