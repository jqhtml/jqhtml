// Loads are counted on a window-level tally rather than on the instance: on_load()
// runs behind a proxy that blocks every property except this.args/this.data, so the
// component cannot record anything on itself (reading this._cid here is what used to
// kill every instance of this component at boot).
window.__reload_test_loads = window.__reload_test_loads || [];

class Data_Component extends Jqhtml_Component {
  async on_load() {
    const data_id = this.args.data_id;
    window.__reload_test_loads.push(data_id);
    console.log(`[Data_Component] on_load() called with data_id: ${data_id}`);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    this.data = {
      data_id,
      value: `Data for ID ${data_id}`,
      timestamp: new Date().toISOString()
    };
  }
}
