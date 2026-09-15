// 400 child components mounted by one parent: component lookup, construction,
// class/attribute application and the child boot + ready fan-in.
const items = Array.from({ length: 800 }, (_, i) => ({ i, label: `Card ${i}` }));
window.jqhtml_bench = {
  name: 'many_components (800 children)',
  run() {
    return window.bench_measure(async () => {
      const host = $('<div>').appendTo('#app');
      const c = host.component('Bench_List', { items }).component();
      await c.ready();
      host.remove();
    });
  },
};
