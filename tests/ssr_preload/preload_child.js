class Preload_Child extends Jqhtml_Component {
  on_create() {
    this.data.value = 'default';
    this.data.source = 'create';
  }

  async on_load() {
    // Counted so the test can check on_load() was skipped without timing it
    window.__preload_child_on_load_calls = (window.__preload_child_on_load_calls || 0) + 1;
    await new Promise(r => setTimeout(r, 300));
    this.data.value = 'from_on_load';
    this.data.source = 'on_load';
  }
}
