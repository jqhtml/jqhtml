// Lifecycle counts live on a window tally rather than on the component: this.data is
// restored to the on_create() snapshot before every on_load(), which is exactly the
// behaviour under test, and it is frozen everywhere else.
window.__rr = { load: 0, render: 0, ready: 0 };

class Render_Reload_Test extends Jqhtml_Component {
  on_create() {
    // Reset on every load; surviving the restore is what proves on_load() ran again.
    this.data.on_load_count = 0;
    this.data.total_loads = 0;
  }

  async on_load() {
    window.__rr.load++;
    this.data.on_load_count++;
    this.data.total_loads = window.__rr.load;
    console.log(`on_load called (total: ${window.__rr.load}, since restore: ${this.data.on_load_count})`);
  }

  on_render() {
    window.__rr.render++;
  }

  async on_ready() {
    window.__rr.ready++;
    console.log(`on_ready called (count: ${window.__rr.ready})`);
  }
}
