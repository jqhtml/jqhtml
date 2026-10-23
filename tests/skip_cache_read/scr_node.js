// Shared behavior of every Scr_* component. on_create() leaves 'init'; on_load() loads
// "<tag>_<window.__scr_version>", so each visit's load is distinguishable. The first
// on_render() of the FIRST instance per name+tag in a visit records what it first painted:
// 'init' on a cache miss, the cached value when it hydrated data or painted an html
// snapshot. A parent's re-render after on_load() replaces its children with new instances,
// which find the cache the first ones just wrote, so only the first instance is recorded;
// `instance` follows the latest one.
class Scr_Node extends Jqhtml_Component {
  on_create() {
    this.data.value = 'init';
    this.state.was_ready_before = this.was_ready_before();
  }
  on_render() {
    if (this.state.painted) return;
    this.state.painted = true;
    const key = this.component_name() + ':' + this.args.tag;
    if (!window.__scr[key]) window.__scr[key] = { first_paint: this.$.children('.val').text() };
    window.__scr[key].instance = this;
  }
  async on_load() {
    await new Promise((resolve) => setTimeout(resolve, 5));
    this.data.value = this.args.tag + '_' + window.__scr_version;
  }
}
window.Scr_Node = Scr_Node;
