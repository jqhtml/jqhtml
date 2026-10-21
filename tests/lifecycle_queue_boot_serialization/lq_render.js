class Lq_Render extends Jqhtml_Component {
  on_create() {
    this.data.loaded = false;
  }

  async on_load() {
    await new Promise(resolve => setTimeout(resolve, 80));
    this.data.loaded = true;
  }

  on_ready() {
    window.__lq_render.on_ready.push(this.data.loaded);
  }
}
