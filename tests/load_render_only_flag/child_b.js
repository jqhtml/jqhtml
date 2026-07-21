class Child_B extends Jqhtml_Component {
  on_create() {
    this.data.value = 'initial_b';
  }

  async on_load() {
    await new Promise(r => setTimeout(r, 30));
    this.data.value = 'loaded_b';
    window.__lro_child_b_on_load_fired = true;
  }

  on_render() {
    window.__lro_child_b_on_render_fired = true;
  }

  on_loaded() {
    window.__lro_child_b_after_load_fired = true;
  }

  async on_ready() {
    window.__lro_child_b_on_ready_fired = true;
  }
}
