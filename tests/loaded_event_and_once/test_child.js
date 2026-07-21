class Test_Child extends Jqhtml_Component {
  on_create() {
    this.data.value = 'initial';
  }

  async on_load() {
    await new Promise(r => setTimeout(r, 200));
    this.data.value = 'loaded';
  }
}
