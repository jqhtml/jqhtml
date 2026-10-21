class Ia_Loaded extends Jqhtml_Component {
  async on_load() {
    this.data.seen_size = this.args.size;
  }
}
