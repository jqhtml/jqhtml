// Loads this.args.page from a table the test controls. When window.__pager_gate is
// set, on_load() parks on it, so the test can look at the DOM while a load is in
// flight (what reload() rendered from cache before on_load() finished).
class Pager extends Jqhtml_Component {
  on_create() {
    this.data.items = [];
    this.state.renders = 0;
    this.state.readies = 0;
  }
  async on_load() {
    if (window.__pager_gate) {
      window.__pager_waiting = true;
      await window.__pager_gate;
      window.__pager_waiting = false;
    }
    this.data.items = window.__pages[this.args.page].slice();
  }
  on_render() { this.state.renders++; }
  on_ready() { this.state.readies++; }
}
