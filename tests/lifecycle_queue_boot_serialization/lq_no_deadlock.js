class Lq_No_Deadlock extends Jqhtml_Component {
  async on_load() {
    await new Promise(resolve => setTimeout(resolve, 10));
    window.__lq_nd.loads++;
    this.data.x = window.__lq_nd.loads;
  }

  on_loaded() {
    if (window.__lq_nd.called) return;
    window.__lq_nd.called = true;
    this.reload();
  }
}
