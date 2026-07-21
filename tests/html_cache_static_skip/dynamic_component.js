class Dynamic_Component extends Jqhtml_Component {
  on_create() {
    this.data.message = null;
  }

  async on_load() {
    // Simulate async data fetch
    await new Promise(resolve => setTimeout(resolve, 10));

    // MODIFY this.data - this makes the component "dynamic"
    this.data.message = 'Loaded from API';
    console.log('[Dynamic_Component] on_load() completed with data modification');
  }
}
