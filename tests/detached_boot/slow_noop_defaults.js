class Slow_Noop_Defaults extends Jqhtml_Component {
  on_create() {
    this.data.message = 'default';
  }

  async on_load() {
    // Waits but does NOT modify this.data
    await new Promise(r => setTimeout(r, 500));
  }
}
