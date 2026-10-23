// on_load() waits on window.__alv_gate when set, so a test can hold the child (and with it
// the page) before ready.
class Alv_Child extends Jqhtml_Component {
  async on_load() {
    if (window.__alv_gate) await window.__alv_gate;
    this.data.loaded = true;
  }
}
