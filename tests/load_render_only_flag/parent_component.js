class Parent_Component extends Jqhtml_Component {
  on_create() {
    this.data.parent_value = 'initial';
  }

  async on_load() {
    await new Promise(r => setTimeout(r, 50));
    this.data.parent_value = 'loaded';
    window.__lro_parent_on_load_fired = true;
  }

  on_render() {
    window.__lro_parent_on_render_count = (window.__lro_parent_on_render_count || 0) + 1;
  }

  on_loaded() {
    window.__lro_parent_after_load_fired = true;
  }

  async on_ready() {
    window.__lro_parent_on_ready_fired = true;
  }
}
