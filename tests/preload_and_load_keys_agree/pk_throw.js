// cache_id() that is armed to throw AFTER boot, so the throw is first seen by load()
// rather than by the create()-phase cache read. That is the path that used to swallow
// the error in a bare catch and silently stop writing the cache.
class Pk_Throw extends Jqhtml_Component {
  cache_id() {
    if (window.__pk_throw_armed) throw new Error('cache_id boom');
    return 'safe_1';
  }

  on_create() { this.data.n = 0; }

  async on_load() {
    // Changes on every load, so load() always reaches its cache-write branch.
    this.data.n = (window.__pk_throw_n = (window.__pk_throw_n || 0) + 1);
  }
}
