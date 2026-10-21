class Load_Hooks_Probe extends Jqhtml_Component {
  on_create() {
    this.data.value = 'initial';
    this.args.version = this.args.version || 1;
    this.state.counts = { on_loaded: 0, on_ready: 0, on_render: 0 };
  }

  async on_load() {
    this.data.value = 'v' + this.args.version;
  }

  on_render() {
    this.state.counts.on_render++;
  }

  on_loaded() {
    this.state.counts.on_loaded++;
  }

  on_ready() {
    this.state.counts.on_ready++;
  }
}
