class Multi_Card extends Jqhtml_Component {
  on_create() {
    window.__mc_created = (window.__mc_created || 0) + 1;
    // The first instance changes a top-level arg; the others must not see it.
    if (window.__mc_created === 1) this.args.theme = 'mutated';
  }
  on_ready() {
    window.__mc_ready = (window.__mc_ready || 0) + 1;
  }
}
