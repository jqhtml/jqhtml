window.apply_load_calls = window.apply_load_calls || {};     // key -> on_load() count
window.apply_loaded_calls = window.apply_loaded_calls || {}; // key -> on_loaded() count

class Apply_Fail_Card extends Jqhtml_Component {
  async on_load() {
    const key = this.args.key;
    window.apply_load_calls[key] = (window.apply_load_calls[key] || 0) + 1;
    const call_number = window.apply_load_calls[key];

    // Async on purpose: followers must have time to join before the leader settles.
    await new Promise((resolve) => setTimeout(resolve, 60));

    if (this.args.mode === 'null_data' && call_number === 1) {
      this.data = null;
      return;
    }

    this.data.label = 'Key ' + key;
    this.data.loaded = true;
  }

  on_loaded() {
    const key = this.args.key;
    window.apply_loaded_calls[key] = (window.apply_loaded_calls[key] || 0) + 1;

    if (this.args.mode === 'throw_loaded' && window.apply_loaded_calls[key] === 1) {
      throw new Error('Apply_Fail_Card on_loaded() failed for key=' + key);
    }
  }
}
