class Static_Child extends Jqhtml_Component {
  on_create() {
    this.data.label = 'static_only';
  }
  // No on_load() — should NOT be captured or preloaded
}
