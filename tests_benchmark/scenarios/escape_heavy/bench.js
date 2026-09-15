// 400 rows x 6 interpolations: <%= %> and <%br= %> on strings that need escaping.
const rows = Array.from({ length: 1500 }, (_, i) => ({
  a: `Name <${i}>`, b: `"quoted" & ampersand ${i}`, c: `plain text cell ${i}`, d: `<b>bold</b> ${i}`, e: `line one\nline two ${i}`, n: i,
}));
window.jqhtml_bench = {
  name: 'escape_heavy (1500 rows x 6 <%= %>)',
  run() {
    return window.bench_measure(async () => {
      const host = $('<div>').appendTo('#app');
      const c = host.component('Bench_Escape', { rows }).component();
      await c.ready();
      host.remove();
    });
  },
};
