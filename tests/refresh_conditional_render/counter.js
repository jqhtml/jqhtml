// Global server state simulation
if (!window.server_data) {
  window.server_data = {
    count: 1
  };
}

// Track render counts outside of this.data since this.data gets reset on reload
if (!window.counter_stats) {
  window.counter_stats = {
    render_count: 0,
    ready_count: 0
  };
}

class Counter extends Jqhtml_Component {
  on_create() {
    this.data.count = 0;
  }

  async on_load() {
    // Simulate fetching from server
    await new Promise(resolve => setTimeout(resolve, 10));

    // Only set the actual data being fetched (not tracking stats)
    this.data.count = window.server_data.count;
  }

  on_render() {
    window.counter_stats.render_count++;
  }

  async on_ready() {
    window.counter_stats.ready_count++;

    // Update display (DOM manipulation, not this.data)
    this.$sid('render_count').text(window.counter_stats.render_count);
    this.$sid('ready_count').text(window.counter_stats.ready_count);
  }
}
