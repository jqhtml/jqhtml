class Parent_Component extends Jqhtml_Component {
  on_create() {
    this.data.value = 'initial';
  }

  async on_load() {
    await new Promise(r => setTimeout(r, 20));
    this.data.value = 'parent_loaded';
    window.__cascade_parent_on_load_fired = true;
  }

  on_render() {
    window.__cascade_parent_on_render_fired = true;
  }

  on_loaded() {
    window.__cascade_parent_after_load_fired = true;
  }

  async on_ready() {
    window.__cascade_parent_on_ready_fired = true;
  }
}
