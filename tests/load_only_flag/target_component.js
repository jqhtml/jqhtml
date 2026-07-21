class Target_Component extends Jqhtml_Component {
  on_create() {
    this.data.value = 'initial';
  }

  async on_load() {
    // Simulate API call
    await new Promise(r => setTimeout(r, 50));
    this.data.value = 'loaded';
    window.__load_only_on_load_fired = true;
  }

  on_render() {
    window.__load_only_on_render_fired = true;
  }

  on_loaded() {
    window.__load_only_after_load_fired = true;
  }

  async on_ready() {
    window.__load_only_on_ready_fired = true;
  }
}

class Child_Component extends Jqhtml_Component {
  on_create() {
    this.data.child_value = 'child_initial';
  }

  async on_load() {
    this.data.child_value = 'child_loaded';
    window.__load_only_child_on_load_fired = true;
  }
}
