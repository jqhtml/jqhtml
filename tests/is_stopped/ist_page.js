// Records is_stopped() at every hook. on_load() waits on window.__ist_gate when set, so a
// test can hold the component before ready.
class Ist_Page extends Jqhtml_Component {
  on_create() {
    this.data.value = 'init';
    this.state.seen = { create: this.is_stopped() };
  }
  on_render() { this.state.seen.render = this.is_stopped(); }
  async on_load() {
    if (window.__ist_gate) await window.__ist_gate;
    this.data.value = 'loaded_' + (window.__ist_n = (window.__ist_n || 0) + 1);
  }
  on_loaded() { this.state.seen.loaded = this.is_stopped(); }
  on_ready() { this.state.seen.ready = this.is_stopped(); }
  on_stop() { this.state.stopped_in_on_stop = this.is_stopped(); }
}
