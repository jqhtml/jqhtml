class Slow_Noop_Component extends Jqhtml_Component {
  async on_load() {
    // Waits but does NOT modify this.data
    await new Promise(r => setTimeout(r, 500));
  }
}
