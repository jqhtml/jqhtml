// on_create() seeds an EMPTY Map; on_load() fills it in place from a source the
// test controls. Every entry of the loaded data lives inside the Map, so a change
// detector that cannot see into a Map sees no change at all.
class Map_Loader extends Jqhtml_Component {
  on_create() {
    this.data.by_id = new Map();
    this.state.renders = 0;
    this.state.readies = 0;
  }
  async on_load() {
    const source = window.__map_sources[this.args.source];
    // $assign: replace the Map instead of filling the on_create() one, so change
    // detection is exercised without depending on the on_create() snapshot.
    if (this.args.assign) { this.data.by_id = new Map(source); return; }
    for (const [key, value] of source) this.data.by_id.set(key, value);
  }
  on_render() { this.state.renders++; }
  on_ready() { this.state.readies++; }
}
