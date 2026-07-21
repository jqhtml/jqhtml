class Child_B_Component extends Jqhtml_Component {
  on_create() {
    this.data.value = 'b_initial';
  }

  async on_load() {
    await new Promise(r => setTimeout(r, 20));
    this.data.value = 'b_loaded';
    window.__cascade_child_b_on_load_fired = true;
  }

  on_render() {
    window.__cascade_child_b_on_render_fired = true;
  }

  on_loaded() {
    window.__cascade_child_b_after_load_fired = true;
  }

  async on_ready() {
    window.__cascade_child_b_on_ready_fired = true;
  }
}
