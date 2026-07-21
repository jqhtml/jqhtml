class Component_A extends Jqhtml_Component {
  on_create() {
    this.data.loading = true;
    console.log('[A] on_create - set loading = true');
  }

  async on_load() {
    console.log('[A] on_load START - waiting 100ms');
    await new Promise(resolve => setTimeout(resolve, 100));
    this.data.loading = false;
    console.log('[A] on_load END - set loading = false');
  }

  on_render() {
    console.log('[A] on_render START');
    console.log('[A] on_render - this.$.html():', this.$.html());

    // Try to find component_d through the DOM hierarchy
    const component_d = this.sid('component_d');
    console.log('[A] on_render - this.sid("component_d"):', component_d);

    if (component_d) {
      console.log('[A] on_render - component_d found!');
      const result = component_d.hello();
      console.log('[A] on_render - component_d.hello() returned:', result);
      window.testResults.component_d_found = true;
      window.testResults.hello_result = result;
    } else {
      console.log('[A] on_render - component_d NOT FOUND');
      window.testResults.component_d_found = false;
    }

    console.log('[A] on_render END');
  }

  async on_ready() {
    console.log('[A] on_ready');
  }
}
