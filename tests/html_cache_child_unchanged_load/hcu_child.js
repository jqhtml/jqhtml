// on_load() assigns exactly what on_create() already put there, so the data after the
// load equals the defaults: no re-render, and therefore no post-load render. An html-mode
// parent waits for each child's DOM to be final before snapshotting; this child's DOM is
// final at the end of its boot render chain, and the wait used to hang on it forever.
class Hcu_Child extends Jqhtml_Component {
  on_create() {
    this.data.label = 'same';
  }

  async on_load() {
    this.data.label = 'same';
  }

  on_render() {
    this.state.renders = (this.state.renders || 0) + 1;
    this.$.attr('data-hcu-rendered', 'yes');
  }
}
