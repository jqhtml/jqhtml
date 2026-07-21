// Cache_Id_Custom - overrides cache_id() to return a FIXED key regardless of this.args.
// Used to prove that cache_id() (not this.args) determines the cache entry.
window.__custom_load_count = window.__custom_load_count || 0;

class Cache_Id_Custom extends Jqhtml_Component {
  on_create() {
    this.data.value = null;
  }

  on_render() {
    // Snapshot whether ANY render of this component was served from cached HTML
    // (html cache mode only). on_render() fires twice on a cache hit: once for the
    // cached-HTML paint (_used_cached_html === true), and again for the forced
    // post-load re-render (by which point the framework has already cleared the
    // flag) - so OR-accumulate rather than overwrite, or the second call would
    // erase the signal from the first.
    this.state.cache_hit_at_render = this.state.cache_hit_at_render || (this._used_cached_html === true);
  }

  // Custom cache key override - deliberately ignores this.args entirely.
  cache_id() {
    return 'fixed_override_key';
  }

  async on_load() {
    window.__custom_load_count = (window.__custom_load_count || 0) + 1;
    const call_num = window.__custom_load_count;
    await new Promise(resolve => setTimeout(resolve, 20));
    this.data.value = `custom_loaded_${call_num}_seed${this.args.seed}`;
  }
}
