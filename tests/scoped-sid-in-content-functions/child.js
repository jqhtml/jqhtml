class Child_Component extends Jqhtml_Component {
  // on_create() is the only place a template-visible default may be set: this.data is
  // deep-frozen during rendering, so the `<% this.data.child_value = ... %>` this
  // template used to open with threw and killed the component at boot.
  on_create() {
    this.data.child_value = 'DATA_FROM_CHILD';
  }
}
