class Rs_Parent extends Jqhtml_Component {
  on_create() {
    // No on_load() on purpose: the parent is ready as soon as its children are,
    // so every ready() assertion below is about the parent's own bookkeeping.
    this.data.counter = 0;
  }
}
