// Group A only means anything with a warm cache of this.data, so it is guarded.
// Group B is mode-independent and runs everywhere - the whole file cannot
// instant-pass. See tests/CLAUDE.md "Mode-Specific Tests".
const VALID_MODES = ['data'];

class On_Load_Restores_Pre_Cache_Snapshot extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const cache_mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';
    const stage = this.$sid('stage');

    try {
      console.log('');
      console.log('A. on_load() RESTARTS FROM THE on_create() STATE ON A WARM CACHE:');

      if (!VALID_MODES.includes(cache_mode)) {
        console.log('   [SKIP] group A only applies to modes: ' + VALID_MODES.join(', ') +
                    ' (current: ' + cache_mode + ')');
      } else {
        // Attach BEFORE creating: create() skips the cache read for a detached
        // element, which would make the warm-cache case below untestable.
        const first = $('<div>').appendTo(stage).component('Snap_List', {}).component();
        await first.ready();

        assert('the first instance appended exactly one row -> ' + first.data.items.length,
               first.data.items.length === 1);

        // The cache write happens inside _apply_load_result(), so it is already done
        // by ready(); assert it anyway, or a missing entry would make the warm-cache
        // assertion below pass for the wrong reason.
        await sleep(50);
        const cached_keys = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.indexOf('Snap_List') !== -1) cached_keys.push(key);
        }
        assert('Snap_List wrote a cache entry -> ' + cached_keys.join(', '), cached_keys.length > 0);

        // Second instance, same args: create() hydrates this.data from that entry.
        // Pre-fix the snapshot was taken AFTER the hydration, so on_load() restarted
        // from ['a'] and pushed a second row.
        const second = $('<div>').appendTo(stage).component('Snap_List', {}).component();
        await second.ready();

        assert('the warm-cache instance still has one row -> ' + second.data.items.length,
               second.data.items.length === 1);
        assert('the warm-cache instance rendered one row -> ' + second.$.find('.count').text(),
               second.$.find('.count').text() === '1');
        assert('the first instance was not disturbed -> ' + first.data.items.length,
               first.data.items.length === 1);
      }

      console.log('');
      console.log('B. load() ON A COMPONENT WITH NO on_load() RUNS NOTHING:');
      const plain = $('<div>').appendTo(stage).component('Snap_Plain', {}).component();
      await plain.ready();

      assert('on_create() data survived the boot -> ' + plain.data.label, plain.data.label === 'x');

      // Pre-fix this ran the detached execution anyway. No snapshot is taken for a
      // component without a custom on_load(), so the detached clone was {} and it
      // was assigned straight over this.data.
      const changed = await plain.load();

      assert('load() returned false -> ' + changed, changed === false);
      assert('this.data still holds the on_create() value -> ' + JSON.stringify(plain.data),
             plain.data.label === 'x');
      assert('the rendered label is untouched -> ' + plain.$.find('.label').text(),
             plain.$.find('.label').text() === 'x');
    } catch (error) {
      console.log('   FAIL: the test itself threw -> ' + error.message);
      console.error(error);
      failed++;
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
