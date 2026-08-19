class Ck_Child extends Jqhtml_Component {
  on_create() { this.data.v = ''; }
  async on_load() { this.data.v = 'loaded'; }
}
