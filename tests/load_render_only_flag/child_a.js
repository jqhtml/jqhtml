class Child_A extends Jqhtml_Component {
  on_create() {
    this.data.value = 'initial_a';
  }

  async on_load() {
    await new Promise(r => setTimeout(r, 30));
    this.data.value = 'loaded_a';
    window.__lro_child_a_on_load_fired = true;
  }

  on_render() {
    window.__lro_child_a_on_render_fired = true;
  }

  on_loaded() {
    window.__lro_child_a_after_load_fired = true;
  }

  async on_ready() {
    window.__lro_child_a_on_ready_fired = true;
  }
}
