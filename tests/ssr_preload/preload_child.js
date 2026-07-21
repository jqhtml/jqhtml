class Preload_Child extends Jqhtml_Component {
  on_create() {
    this.data.value = 'default';
    this.data.source = 'create';
  }

  async on_load() {
    await new Promise(r => setTimeout(r, 300));
    this.data.value = 'from_on_load';
    this.data.source = 'on_load';
  }
}
