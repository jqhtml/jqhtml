class Cacheable_Component extends Jqhtml_Component {
  on_create() {
    this.data = {
      name: '',
      email: '',
      loaded: false
    };
  }

  async on_load() {
    // Increment global counter to track how many times on_load() is called
    window.on_load_call_count = (window.on_load_call_count || 0) + 1;
    console.log(`[Cacheable_Component] on_load() called (count: ${window.on_load_call_count})`);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 50));

    // Simulate fetching data
    this.data = {
      name: `Item ${this.args.item_id}`,
      email: `item${this.args.item_id}@example.com`,
      loaded: true
    };

    console.log(`[Cacheable_Component] on_load() complete, data:`, JSON.stringify(this.data));
  }
}
