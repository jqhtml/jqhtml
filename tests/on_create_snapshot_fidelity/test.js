// CLAUDE.md: "this.data is RESTORED to on_create() state before each on_load() call".
// The snapshot used to be a JSON copy, so on_load() was handed a Date as an ISO
// string, a Map or Set as {}, a register_cache_class() instance as a plain object
// without its methods, and a key holding undefined not at all. The snapshot is now
// the cache serializer's, which keeps all of them.
//
// Runs in all three cache modes. In 'data' mode the boot reads the cache first;
// the snapshot is taken before that read, so the first on_load() must see the
// on_create() state too (checked by the second instance, which boots warm).

class On_Create_Snapshot_Fidelity extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const cache_mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';
    const stage = this.$sid('stage');
    const check_seen = (label, seen) => {
      console.log('   seen: ' + JSON.stringify(seen));
      assert(label + ': Date is a Date', seen.when_is_date === true);
      assert(label + ': Date holds the on_create() time -> ' + seen.when_ms, seen.when_ms === Date.UTC(2026, 0, 2, 3, 4, 5));
      assert(label + ': Map is a Map', seen.map_is_map === true);
      assert(label + ': Map holds only the on_create() entry -> ' + seen.map_entries, seen.map_entries === '[["a",1]]');
      assert(label + ': Set is a Set', seen.set_is_set === true);
      assert(label + ': Set holds only the on_create() member -> ' + seen.set_items, seen.set_items === '["x"]');
      assert(label + ': the key holding undefined is present', seen.has_nothing_key === true);
      assert(label + ': ...and still undefined', seen.nothing_is_undefined === true);
      assert(label + ': registered class instance survives with its methods -> ' + seen.model_doubled,
             seen.model_is_instance === true && seen.model_doubled === 42);
      assert(label + ': array keeps its undefined element -> length ' + seen.list_length,
             seen.list_length === 3 && seen.list_hole_undefined === true);
      assert(label + ': counter restarts at 0 -> ' + seen.loads, seen.loads === 0);
      assert(label + ': keys in on_create() order -> ' + seen.keys, seen.keys === 'when,by_id,tags,nothing,model,list,loads');
    };

    try {
      console.log('');
      console.log('A. FIRST on_load() (boot)');
      window.__fidelity_seen = [];
      const w = $('<div>').appendTo(stage).component('Fidelity_Widget', {}).component();
      await w.ready();
      assert('on_load() ran once -> ' + window.__fidelity_seen.length, window.__fidelity_seen.length === 1);
      check_seen('boot', window.__fidelity_seen[0]);

      console.log('');
      console.log('B. SECOND on_load() (reload) after the first one mutated everything');
      await w.reload();
      assert('on_load() ran twice -> ' + window.__fidelity_seen.length, window.__fidelity_seen.length === 2);
      check_seen('reload', window.__fidelity_seen[1]);
      assert('this.data holds the second load result -> loads=' + w.data.loads, w.data.loads === 1);
      assert('...as live types: Map has the loaded entry', w.data.by_id instanceof Map && w.data.by_id.get('b') === 2);

      console.log('');
      console.log('C. load() and refresh() restart from the same state');
      await w.load();
      check_seen('load()', window.__fidelity_seen[2]);
      await w.refresh();
      check_seen('refresh()', window.__fidelity_seen[3]);

      if (cache_mode === 'data') {
        console.log('');
        console.log('D. data mode: a warm-cache instance still restarts on_load() from on_create()');
        const warm = $('<div>').appendTo(stage).component('Fidelity_Widget', {}).component();
        await warm.ready();
        const seen = window.__fidelity_seen[window.__fidelity_seen.length - 1];
        assert('the warm instance ran on_load() -> ' + window.__fidelity_seen.length, window.__fidelity_seen.length === 5);
        check_seen('warm boot', seen);
      }
    } catch (error) {
      console.log('   FAIL: the test itself threw -> ' + error.message);
      console.error(error);
      failed++;
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
