class Child_Component extends Jqhtml_Component {
  on_create() {
    console.log('[CHILD] on_create() called with args:', JSON.stringify(this.args));
    this.data.count = 0;
    this.data.timestamp = '';
  }

  async on_load() {
    console.log('[CHILD] on_load() called with args:', JSON.stringify(this.args));
    console.log('[CHILD] Current filter:', this.args.filter);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));

    this.data = {
      count: Math.floor(Math.random() * 100),
      timestamp: new Date().toISOString(),
      filter: this.args.filter  // Store what filter was used
    };

    console.log('[CHILD] on_load() complete, data:', JSON.stringify(this.data));
  }

  on_ready() {
    console.log('[CHILD] on_ready() called');
  }
}
