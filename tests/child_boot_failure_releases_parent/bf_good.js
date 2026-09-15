class Bf_Good extends Jqhtml_Component {
  on_create() {
    this.data.label = 'initial';
  }

  async on_load() {
    await new Promise((resolve) => setTimeout(resolve, 20));
    this.data.label = 'loaded';
  }
}
