class Create_Event_Fires_Once extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };

    // Every wait races an explicit deadline so a component that never becomes ready
    // shows up as a FAILED assertion rather than a harness timeout with no summary.
    const settled = (promise, ms) => Promise.race([
      Promise.resolve(promise).then(() => true, () => false),
      new Promise((resolve) => setTimeout(() => resolve(false), ms))
    ]);
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const stage = this.$sid('stage');

    try {
      console.log('');
      console.log("A. 'create' FIRES EXACTLY ONCE FOR A SUBSCRIBER ATTACHED AT BOOT:");

      let on_count = 0;
      let once_count = 0;

      const probe = $('<div>').appendTo(stage).component('Ce_Probe', {}).component();

      // Registered as early as a caller can: whether create() has already run or not,
      // the subscriber must end up with exactly one call. Pre-fix, lifecycle-manager
      // triggered 'create' a second time after component.create() had already fired it,
      // so sticky replay + the duplicate trigger gave this handler 2.
      probe.on('create', () => { on_count++; });
      probe.once('create', () => { once_count++; });

      assert('the probe reaches ready', await settled(probe.ready(), 2000));
      await sleep(50);

      // Ce_Probe subscribes from inside its own on_create() - the only vantage point that
      // sees the trigger itself rather than the sticky replay. This is the assertion that
      // fails (2) against the duplicate trigger.
      assert("on('create') from inside on_create() fired exactly once -> " + probe.state.on_fires,
             probe.state.on_fires === 1);
      assert("once('create') from inside on_create() fired exactly once -> " + probe.state.once_fires,
             probe.state.once_fires === 1);

      assert("on('create') attached after boot fired exactly once -> " + on_count, on_count === 1);
      assert("once('create') attached after boot fired exactly once -> " + once_count, once_count === 1);

      console.log('');
      console.log('B. A LISTENER REGISTERED AFTER ready() STILL FIRES EXACTLY ONCE:');

      let late_on_count = 0;
      let late_once_count = 0;
      probe.on('create', () => { late_on_count++; });
      probe.once('create', () => { late_once_count++; });
      await sleep(50);

      assert("late on('create') replayed exactly once -> " + late_on_count, late_on_count === 1);
      assert("late once('create') replayed exactly once -> " + late_once_count, late_once_count === 1);

      console.log('');
      console.log('C. THE EARLY SUBSCRIBERS WERE NOT FIRED AGAIN BY THE LATE REPLAY:');
      assert("the boot-time on('create') is still at 1 -> " + on_count, on_count === 1);
      assert("the boot-time once('create') is still at 1 -> " + once_count, once_count === 1);

      probe.stop();
      probe.$.remove();
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
