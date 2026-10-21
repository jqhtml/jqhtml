class Lq_Seq extends Jqhtml_Component {
  on_create() {
    this.data.value = '';
  }

  async on_load() {
    const tag = this.args.tag;
    const delay = window.__lq_seq.delays.length ? window.__lq_seq.delays.shift() : 0;
    await new Promise(resolve => setTimeout(resolve, delay));
    this.data.value = tag;
  }
}
