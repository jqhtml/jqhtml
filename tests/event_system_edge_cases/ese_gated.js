class Ese_Gated extends Jqhtml_Component {
  on_create() {
    this.data.label = 'initial';
  }

  async on_load() {
    await window.__ese_gate;
    this.data.label = 'loaded';
  }
}
