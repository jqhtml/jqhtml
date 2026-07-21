class Component_B extends Jqhtml_Component {
  on_create() {
    console.log('[B] on_create');
  }

  on_render() {
    console.log('[B] on_render');
  }

  async on_ready() {
    console.log('[B] on_ready');
  }
}
