window.__rs_poller_load_calls = window.__rs_poller_load_calls || 0;
window.__rs_poller_ready_calls = window.__rs_poller_ready_calls || 0;
window.__rs_poller_delay = window.__rs_poller_delay || 0;

class Rs_Poller extends Jqhtml_Component {
  on_create() {
    this.data.label = 'initial';
  }

  async on_load() {
    window.__rs_poller_load_calls++;

    const delay = window.__rs_poller_delay || 0;
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));

    // CONSTANT on purpose: refresh() compares this against the data used in the
    // last render, finds it identical, and skips both the re-render and on_ready().
    this.data.label = 'constant';
    this.data.items = [1, 2, 3];
  }

  on_ready() {
    window.__rs_poller_ready_calls++;
  }
}
