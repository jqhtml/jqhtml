class Cfg_Child extends Jqhtml_Component {
  on_create() { this.data.value = 'initial'; }
  async on_load() { this.data.value = 'loaded'; }
}
