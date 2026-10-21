class Lq_Warn_Hooks extends Jqhtml_Component {
  on_create() {
    this.data.n = 0;
    this.load();
  }

  async on_load() {
    await new Promise(resolve => setTimeout(resolve, 10));
    this.data.n = 1;
  }

  on_render() {
    if (this.state.called) return;
    this.state.called = true;
    this.refresh();
  }
}
