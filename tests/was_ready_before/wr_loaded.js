class Wr_Loaded extends Jqhtml_Component {
  on_create() { this.state.cold = !this.was_ready_before(); }
  async on_load() {
    if (window.__wr_gate) await window.__wr_gate;
    this.data.value = 'v' + this.args.id;
  }
  on_ready() { this.state.in_ready = this.was_ready_before(); }
}
