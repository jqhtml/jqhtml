class Reload_Test_Component extends Jqhtml_Component {
  on_create() {
    // Initialize global reload counter for this component instance
    // Using window because this.state can't be accessed in on_load()
    const cid = this._cid;
    window.__reload_counters__ = window.__reload_counters__ || {};
    window.__reload_counters__[cid] = 0;

    this.data.value = 'initial';
    this.data.reload_count = 0;
  }

  async on_load() {
    // Increment the global counter (this.state not accessible here)
    const cid = this.args.sid || 'default';  // Use sid from args as identifier
    window.__test_reload_count__ = (window.__test_reload_count__ || 0) + 1;

    // Simulate async data fetch with delay
    await new Promise(resolve => setTimeout(resolve, 100));

    this.data.reload_count = window.__test_reload_count__;
    this.data.value = 'loaded_' + window.__test_reload_count__;
  }

  on_ready() {
    console.log(`[Reload_Test_Component] on_ready() called - reload_count=${this.data.reload_count}, value=${this.data.value}`);
  }
}
