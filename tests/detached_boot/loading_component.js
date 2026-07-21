class Loading_Component extends Jqhtml_Component {
  async on_load() {
    await new Promise(r => setTimeout(r, 300));
    this.data.message = 'loaded';
  }
}
