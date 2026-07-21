class Counter_Component extends Jqhtml_Component {
  on_create() {
    this.data.message = null;
    this.data.timestamp = null;
  }

  on_render() {
    // Increment on_render counter
    if (!window.on_render_count) window.on_render_count = 0;
    window.on_render_count++;
    console.log(`[Counter_Component] on_render #${window.on_render_count}`);
  }

  async on_load() {
    // Simulate data lookup with 20ms delay
    await new Promise(resolve => setTimeout(resolve, 20));

    // Set data to trigger re-render and caching
    this.data.message = 'Loaded successfully';
    this.data.timestamp = new Date().toISOString();
  }
}
