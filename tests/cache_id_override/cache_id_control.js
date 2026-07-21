// Cache_Id_Control - control component, NO cache_id() override.
// Cache key falls back to standard component_name + args generation, so
// different args MUST produce different cache entries.
window.__control_load_count = window.__control_load_count || 0;

class Cache_Id_Control extends Jqhtml_Component {
  on_create() {
    this.data.value = null;
  }

  on_render() {
    // See Cache_Id_Custom.on_render() - OR-accumulate across possibly two calls.
    this.state.cache_hit_at_render = this.state.cache_hit_at_render || (this._used_cached_html === true);
  }

  async on_load() {
    window.__control_load_count = (window.__control_load_count || 0) + 1;
    const call_num = window.__control_load_count;
    await new Promise(resolve => setTimeout(resolve, 20));
    this.data.value = `control_loaded_${call_num}_seed${this.args.seed}`;
  }
}
