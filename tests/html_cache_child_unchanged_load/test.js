// A dynamic html-mode parent waits for its children's final DOM before it snapshots. A
// child whose on_load() returns data equal to its on_create() defaults never re-renders,
// and that wait used to hang on it forever - on the first boot and on a cache-hit boot.
const VALID_MODES = ['html'];

class Html_Cache_Child_Unchanged_Load extends Jqhtml_Component {
  on_create() {
    // Must be on_create(): a second set_cache_key() call is a cache reset, and children
    // created before it would have booted against a different key.
    window.jqhtml.set_cache_key('html_cache_child_unchanged_load_key', 'html');
    window.__hcu_parent_cache_injections = 0;
  }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    const mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';
    if (!VALID_MODES.includes(mode)) {
      console.log('[SKIP] Test only applies to modes: ' + VALID_MODES.join(', ') + ' (current: ' + mode + ')');
      console.log('SUMMARY: skipped (mode ' + mode + ')');
      window.testPassed = true;
      return;
    }

    let passed = 0, failed = 0;
    const assert = (name, ok) => {
      console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name);
      ok ? passed++ : failed++;
    };

    const with_timeout = (promise, ms) =>
      Promise.race([promise.then(() => 'done'), new Promise(r => setTimeout(() => r('timeout'), ms))]);

    const snapshot_text = () => {
      const keys = Object.keys(window.localStorage)
        .filter(k => k.indexOf('hcu_parent') !== -1 && k.indexOf('::html') !== -1);
      return keys.length === 1 ? window.localStorage.getItem(keys[0]) : null;
    };

    const check_parent = (label, parent) => {
      assert(label + ': the parent rendered its loaded data -> ' + parent.$sid('title').text(),
             parent.$sid('title').text() === 'parent loaded');
      const child = parent.$sid('child').data('_component');
      assert(label + ': the child is a live component', !!child && !child._stopped);
      assert(label + ': the child reached ready -> _ready_state ' + (child && child._ready_state),
             !!child && child._ready_state === 4);
      assert(label + ': the child\'s load really left its data unchanged -> ' +
             (child && JSON.stringify(child.data)),
             !!child && JSON.stringify(child.data) === '{"label":"same"}');
      assert(label + ': the child rendered once (no post-load re-render) -> ' + (child && child.state.renders),
             !!child && child.state.renders === 1);
      assert(label + ': the child was marked render-complete',
             !!child && child._on_render_complete === true);
    };

    // ---------------------------------------------------------------------------
    // A. FIRST BOOT (cache miss)
    // ---------------------------------------------------------------------------
    console.log('');
    console.log('A. FIRST BOOT, CHILD LOAD LEAVES DATA UNCHANGED:');
    assert('no snapshot exists before the first boot', snapshot_text() === null);

    const $first = $('<div>').appendTo(this.$sid('first_host'));
    $first.component('Hcu_Parent', {});
    const first = $first.component();

    const first_result = await with_timeout(first.ready(), 1000);
    assert('the parent reached ready() within 1s -> ' + first_result, first_result === 'done');

    if (first_result === 'done') {
      check_parent('A', first);
      const snap = snapshot_text();
      assert('the parent wrote its html snapshot', snap !== null);
      assert('the snapshot holds the child\'s final DOM (its on_render() mark and label)',
             snap !== null && snap.indexOf('data-hcu-rendered') !== -1 &&
             snap.indexOf('same') !== -1 && snap.indexOf('parent loaded') !== -1);
    }

    // ---------------------------------------------------------------------------
    // B. CACHE-HIT BOOT
    //    A Hcu_Parent with the same cache_id() injects the snapshot, loads,
    //    re-renders (forced), and boots a fresh Hcu_Child whose load again leaves
    //    its data unchanged - then waits for it before re-snapshotting.
    // ---------------------------------------------------------------------------
    console.log('');
    console.log('B. CACHE-HIT BOOT, CHILD LOAD LEAVES DATA UNCHANGED:');
    $first.remove();

    // Seed the snapshot from a parent whose child is template-only, so this part
    // proves the cache-hit path on its own even if part A hung.
    const $seed = $('<div>').appendTo(this.$sid('second_host'));
    $seed.component('Hcu_Parent', { seed: true });
    const seed_result = await with_timeout($seed.component().ready(), 1000);
    assert('the seeding parent reached ready() within 1s -> ' + seed_result, seed_result === 'done');
    const seeded = snapshot_text();
    assert('the seeding parent wrote the snapshot',
           seeded !== null && seeded.indexOf('seed leaf') !== -1);
    $seed.remove();
    window.__hcu_parent_cache_injections = 0;

    const $second = $('<div>').appendTo(this.$sid('second_host'));
    $second.component('Hcu_Parent', {});
    const second = $second.component();

    const second_result = await with_timeout(second.ready(), 1000);
    assert('the parent reached ready() within 1s -> ' + second_result, second_result === 'done');
    assert('the boot was a cache hit (snapshot injected) -> ' + window.__hcu_parent_cache_injections,
           window.__hcu_parent_cache_injections === 1);

    if (second_result === 'done') {
      check_parent('B', second);
      assert('no stopped markup was left behind -> ' + second.$.find('._Component_Stopped').length,
             second.$.find('._Component_Stopped').length === 0);
      const snap = snapshot_text();
      assert('the parent re-snapshotted with the child\'s final DOM (not the seed\'s)',
             snap !== null && snap.indexOf('data-hcu-rendered') !== -1 &&
             snap.indexOf('same') !== -1 && snap.indexOf('seed leaf') === -1);
    }

    console.log('');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = failed === 0;
  }
}
