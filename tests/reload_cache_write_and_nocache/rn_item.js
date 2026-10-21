// Loads this.args.id from a table the test controls. When window.__rn_gate is set,
// on_load() parks on it, so the test can see what a boot rendered from the cache
// before the fresh load finished.
class Rn_Item extends Jqhtml_Component {
  on_create() {
    this.data.items = [];
  }
  async on_load() {
    if (window.__rn_gate) {
      window.__rn_waiting = true;
      await window.__rn_gate;
      window.__rn_waiting = false;
    }
    this.data.items = window.__rn_rows[this.args.id].slice();
  }
}
