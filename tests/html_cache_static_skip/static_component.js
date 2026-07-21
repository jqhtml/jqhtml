class Static_Component extends Jqhtml_Component {
  on_create() {
    // Set default value in on_create()
    this.data.label = 'Default Label';
  }

  async on_load() {
    // Simulate some async work, but DON'T modify this.data
    await new Promise(resolve => setTimeout(resolve, 10));

    // Note: We intentionally don't modify this.data here
    // This makes the component "static" - it renders identically every time
    console.log('[Static_Component] on_load() completed without modifying this.data');
  }
}
