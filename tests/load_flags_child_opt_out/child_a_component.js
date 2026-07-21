class Child_A_Component extends Jqhtml_Component {
  on_create() {
    this.data.value = 'a_initial';
  }

  async on_load() {
    await new Promise(r => setTimeout(r, 20));
    this.data.value = 'a_loaded';
    window.__cascade_child_a_on_load_fired = true;
  }

  on_render() {
    window.__cascade_child_a_on_render_fired = true;
  }

  on_loaded() {
    window.__cascade_child_a_after_load_fired = true;
  }

  async on_ready() {
    window.__cascade_child_a_on_ready_fired = true;
  }
}
