class Child_Boot_Failure_Releases_Parent extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };

    // Every wait races an explicit deadline. A parent that never becomes ready
    // must show up as a FAILED assertion, never as a harness timeout.
    const settled = (promise, ms) => Promise.race([
      Promise.resolve(promise).then(() => true, () => false),
      new Promise((resolve) => setTimeout(() => resolve(false), ms))
    ]);
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const stage = this.$sid('stage');

    try {
      console.log('');
      console.log('A. A CHILD WHOSE on_load() THROWS DOES NOT WEDGE ITS PARENT:');
      const parent_a = $('<div>').component('Bf_Parent', {}).appendTo(stage).component();

      // Pre-fix: boot_component rethrew, nothing stopped Bf_Bad, and the parent
      // sat in _wait_for_children_ready() on a 'ready' that could never fire.
      assert('the parent reaches ready despite the failing child',
             await settled(parent_a.ready(), 1000));

      const bad = parent_a.sid('bad');
      const good = parent_a.sid('good');

      assert('the failing child exists -> ' + !!bad, !!bad);
      assert('the failing child is marked _Component_Stopped',
             !!bad && bad.$.hasClass('_Component_Stopped'));
      assert('the failing child reports _stopped -> ' + (bad && bad._stopped),
             !!bad && bad._stopped === true);
      assert('the failing child is de-registered from the parent\'s _dom_children',
             !!bad && !parent_a._dom_children.has(bad));
      assert('the healthy sibling still reaches ready',
             !!good && await settled(good.ready(), 1000));
      assert('the healthy sibling actually loaded -> ' + (good && good.$.text().trim()),
             !!good && good.$.text().trim() === 'loaded');

      console.log('');
      console.log('B. A FAILING BOOT IS NOT AN UNHANDLED REJECTION:');
      let unhandled = 0;
      const on_unhandled = () => { unhandled++; };
      window.addEventListener('unhandledrejection', on_unhandled);

      // $(el).component() calls _boot() unawaited with no catch (audit bug 13):
      // any throw inside the boot chain used to escape as an unhandled rejection.
      $('<div>').component('Bf_Bad', {}).appendTo(stage);
      await sleep(500);
      window.removeEventListener('unhandledrejection', on_unhandled);

      assert('no unhandledrejection from the failed boot -> ' + unhandled, unhandled === 0);

      console.log('');
      console.log('C. A COMPONENT STOPPED MID-RELOAD RUNS NO MORE HOOKS:');
      const slow = $('<div>').component('Bf_Slow', {}).appendTo(stage).component();
      assert('the slow component reaches ready', await settled(slow.ready(), 2000));

      const ready_calls_before = window.__bf_slow_ready_calls;
      const loaded_calls_before = window.__bf_slow_loaded_calls;

      slow.reload();            // deliberately NOT awaited - it parks in on_load()
      await sleep(50);
      slow.stop();              // stopped while reload() is mid-await
      await sleep(500);         // well past the 200ms on_load()

      assert('on_ready() did not run after the stop -> ' +
             (window.__bf_slow_ready_calls - ready_calls_before),
             window.__bf_slow_ready_calls === ready_calls_before);
      assert('on_loaded() did not run after the stop -> ' +
             (window.__bf_slow_loaded_calls - loaded_calls_before),
             window.__bf_slow_loaded_calls === loaded_calls_before);

      console.log('');
      console.log('D. A PLAIN CHILD IS FULLY STOPPED ON RE-RENDER:');
      const parent_d = $('<div>').component('Bf_Plain_Parent', {}).appendTo(stage).component();
      assert('the parent reaches ready', await settled(parent_d.ready(), 2000));

      const old_child = parent_d.sid('plain');
      assert('the first child instance exists -> ' + !!old_child, !!old_child);

      assert('the parent can re-render', await settled(parent_d.render(), 2000));

      // Bf_Plain has no on_stop() and no 'stop' listeners: _stop() used to take a
      // fast path here that set neither the class nor the de-registration.
      assert('the outgoing child reports _stopped -> ' + (old_child && old_child._stopped),
             !!old_child && old_child._stopped === true);
      assert('the outgoing child is marked _Component_Stopped',
             !!old_child && old_child.$.hasClass('_Component_Stopped'));
      assert('the outgoing child is gone from the parent\'s _dom_children',
             !!old_child && !parent_d._dom_children.has(old_child));

      const fresh_child = parent_d.sid('plain');
      assert('the re-render produced a different live child instance',
             !!fresh_child && fresh_child !== old_child && fresh_child._stopped === false);

      // The child above is watched by its parent's _wait_for_children_ready(), which
      // leaves a 'stop' listener on it - so _stop() never took the fast path for it.
      // A component nobody is waiting on has neither a custom on_stop() nor any
      // listener, which is exactly the case the fast path used to short-circuit.
      const lone = $('<div>').appendTo(stage).component('Bf_Plain', {}).component();
      assert('the lone component reaches ready', await settled(lone.ready(), 2000));
      assert('the lone component has no stop listener (it would hide the fast path)',
             lone._on_registered('stop') === false);
      assert('the lone component registered with its DOM parent',
             this._dom_children.has(lone));

      lone.stop();
      assert('a stopped lone component is marked _Component_Stopped',
             lone.$.hasClass('_Component_Stopped'));
      assert('a stopped lone component is de-registered from its DOM parent',
             !this._dom_children.has(lone));

      console.log('');
      console.log('E. create EVENT COUNT (RECORDED, NOT ASSERTED - see audit bug 18):');
      let create_count = 0;
      const $probe = $('<div>').component('Bf_Plain', {}).appendTo(stage);
      $probe.component().on('create', () => { create_count++; });
      await sleep(100);
      console.log('   create fired ' + create_count + ' times');
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
