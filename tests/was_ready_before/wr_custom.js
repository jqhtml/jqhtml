class Wr_Custom extends Jqhtml_Component {
  cache_id() { return 'custom_' + this.args.id; }
  on_create() { this.state.cold = !this.was_ready_before(); }
}
