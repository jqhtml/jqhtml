class Lrn_Prod extends Jqhtml_Component {
  async on_load() {
    this.data = window.__lrn_make_payload();
  }
}
