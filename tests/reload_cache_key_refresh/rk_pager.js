// Loads this.args.page from a table the test controls. When window.__rk_gate is set,
// on_load() parks on it, so the test can see what a boot rendered from the cache
// before the fresh load finished.
class Rk_Pager extends Jqhtml_Component {
  on_create() {
    this.data.items = [];
  }
  async on_load() {
    if (window.__rk_gate) {
      window.__rk_waiting = true;
      await window.__rk_gate;
      window.__rk_waiting = false;
    }
    this.data.items = window.__rk_pages[this.args.page].slice();
  }
}
