window.__bf_slow_loaded_calls = window.__bf_slow_loaded_calls || 0;
window.__bf_slow_ready_calls = window.__bf_slow_ready_calls || 0;

class Bf_Slow extends Jqhtml_Component {
  on_create() {
    this.data.tick = 0;
  }

  async on_load() {
    // Long enough that the test can stop() the component while reload() is
    // parked in here, which is exactly the window audit bug 10 was about.
    await new Promise((resolve) => setTimeout(resolve, 200));
    this.data.tick = (this.data.tick || 0) + 1;
  }

  on_loaded() {
    window.__bf_slow_loaded_calls++;
  }

  on_ready() {
    window.__bf_slow_ready_calls++;
  }
}
