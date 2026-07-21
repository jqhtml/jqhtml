class Async_Bootable extends Jqhtml_Component {
  async on_load() {
    const delay = this.args.delay || 100;
    console.log(`[Async_Bootable] on_load() - Starting ${delay}ms delay`);

    // Simulate async data loading
    await new Promise(resolve => setTimeout(resolve, delay));

    this.data.loaded = true;
    this.data.value = 'Async data loaded successfully';

    console.log('[Async_Bootable] on_load() - Delay complete, data loaded');
  }

  on_ready() {
    console.log('[Async_Bootable] on_ready() - Component fully ready');
    console.log('[Async_Bootable] this.data.loaded:', this.data.loaded);
  }
}
