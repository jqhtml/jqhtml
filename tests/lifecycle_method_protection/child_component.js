class Child_Component extends Jqhtml_Component {
  async on_load() {
    console.log('[Child] on_load() called');
    this.data.child_value = 'loaded';
  }

  on_ready() {
    console.log('[Child] on_ready() called');
  }
}
