class Component_D extends Jqhtml_Component {
  on_create() {
    console.log('[D] on_create');
  }

  on_render() {
    console.log('[D] on_render');
  }

  hello() {
    console.log('[D] hello() called');
    return 'Hello from Component D!';
  }

  async on_ready() {
    console.log('[D] on_ready');
  }
}
