class Loading_Defaults extends Jqhtml_Component {
  on_create() {
    this.data.message = 'default';
    this.data.loaded = false;
  }

  async on_load() {
    await new Promise(r => setTimeout(r, 300));
    this.data.message = 'loaded';
    this.data.loaded = true;
  }
}
