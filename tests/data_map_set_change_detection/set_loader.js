// Same shape as Map_Loader, with a Set.
class Set_Loader extends Jqhtml_Component {
  on_create() {
    this.data.tags = new Set();
    this.state.renders = 0;
    this.state.readies = 0;
  }
  async on_load() {
    const source = window.__set_sources[this.args.source];
    if (this.args.assign) { this.data.tags = new Set(source); return; }  // see Map_Loader
    for (const tag of source) this.data.tags.add(tag);
  }
  on_render() { this.state.renders++; }
  on_ready() { this.state.readies++; }
}
