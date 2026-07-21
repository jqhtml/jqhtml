// Track on_load calls globally
if (!window.on_load_calls) {
  window.on_load_calls = {};
}

class User_Card extends Jqhtml_Component {
  async on_load() {
    const user_id = this.args.user_id;

    // Track calls per user_id
    if (!window.on_load_calls[user_id]) {
      window.on_load_calls[user_id] = 0;
    }
    window.on_load_calls[user_id]++;

    const call_count = window.on_load_calls[user_id];
    console.log(`[on_load] user_id=${user_id}, call#=${call_count}`);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));

    this.data.name = `User ${user_id}`;
    this.data.loaded = true;
  }
}
