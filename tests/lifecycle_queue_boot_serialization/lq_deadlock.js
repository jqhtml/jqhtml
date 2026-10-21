class Lq_Deadlock extends Jqhtml_Component {
  async on_load() {
    await new Promise(resolve => setTimeout(resolve, 10));
    this.data.x = 1;
  }

  async on_loaded() {
    if (window.__lq_dl_once) return;
    window.__lq_dl_once = true;
    await this.reload();
  }
}
