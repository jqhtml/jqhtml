class Component_C extends Jqhtml_Component {
  on_create() {
    console.log('[C] on_create');
  }

  on_render() {
    console.log('[C] on_render');
  }

  async on_ready() {
    console.log('[C] on_ready');
  }
}
