/**
 * Size_Cap_Component - returns a small or large payload from on_load() depending on
 * window.__CACHE_CAP_PHASE__ ('small' | 'big'), set by the driving test before each
 * load/reload() call.
 *
 * cache_id() returns a FIXED string regardless of args/phase, so the localStorage key
 * this component caches under never changes between phases - only the size of the value
 * being stored changes. This is what lets the test prove that an oversized write to an
 * EXISTING key removes the previously-cached entry (local-storage.ts ~622-640).
 *
 * NOTE: on_load() can only read/write this.data and read this.args (see CLAUDE.md
 * "on_load() Access Restrictions") - it cannot read this.state - so the phase is driven
 * via a plain global (window.__CACHE_CAP_PHASE__) rather than component state.
 */
class Size_Cap_Component extends Jqhtml_Component {
  cache_id() {
    return 'cache_entry_size_cap_fixed_key';
  }

  on_create() {
    this.data.tag = 'init';
    this.data.length = 0;
  }

  async on_load() {
    if (window.__CACHE_CAP_PHASE__ === 'big') {
      // > 1MB when serialized - see local-storage.ts size_mb > 1 check
      const payload = 'x'.repeat(window.__CACHE_CAP_BIG_SIZE__ || 1200000);
      this.data.tag = 'big';
      this.data.payload = payload;
      this.data.length = payload.length;
    } else {
      const payload = 'small-cache-entry-value';
      this.data.tag = 'small';
      this.data.payload = payload;
      this.data.length = payload.length;
    }
  }
}
