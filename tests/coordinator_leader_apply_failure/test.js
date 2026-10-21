class Coordinator_Leader_Apply_Failure extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };

    const coordinator = window.jqhtml.Load_Coordinator;
    const registry = () => JSON.stringify(coordinator.get_registry_state());

    // Every wait here races an explicit deadline. A hang must show up as a FAILED
    // assertion, never as the harness timing out.
    const settled = (promise, ms) => Promise.race([
      Promise.resolve(promise).then(() => true, () => false),
      new Promise((resolve) => setTimeout(() => resolve(false), ms))
    ]);
    const wait_until = (predicate, ms) => new Promise((resolve) => {
      const deadline = Date.now() + ms;
      const tick = () => {
        if (predicate()) return resolve(true);
        if (Date.now() >= deadline) return resolve(false);
        setTimeout(tick, 10);
      };
      tick();
    });

    const stage = this.$sid('stage');
    const make_card = (args) => $('<div>').component('Apply_Fail_Card', args).appendTo(stage).component();

    // One leader and two followers whose leader fails in the apply step. All three must
    // settle (fail in boot) within 1s, the entry must be gone, and a later card with
    // the same args must become a new leader and load real data.
    const run_scenario = async (key, mode, extra) => {
      const boot_errors = [];
      const original_error = console.error;
      console.error = (...a) => { boot_errors.push(a.map(String).join(' ')); original_error.apply(console, a); };

      const leader = make_card({ key, mode });
      make_card({ key, mode });   // follower
      make_card({ key, mode });   // follower
      const boot_failure = new RegExp('\\[JQHTML Error\\] Apply_Fail_Card#\\w+ failed in boot');
      const all_failed = await wait_until(
        () => boot_errors.filter((m) => boot_failure.test(m)).length >= 3,
        1000
      );
      console.error = original_error;

      assert('leader AND both followers settle within 1s', all_failed);
      assert('only the leader ran on_load() -> ' + window.apply_load_calls[key], window.apply_load_calls[key] === 1);
      assert('registry is empty after the leader failure -> ' + registry(), registry() === '{}');
      if (extra) extra(leader, boot_errors);

      const retry_card = make_card({ key, mode });
      const retry_ready = await settled(retry_card.ready(), 2000);
      assert('a later same-args card reaches ready within 2s', retry_ready);
      assert('it ran on_load() itself -> ' + window.apply_load_calls[key], window.apply_load_calls[key] === 2);
      assert('it loaded real data -> ' + retry_card.data.label, retry_card.data.label === 'Key ' + key);
      assert('registry is empty once it finished -> ' + registry(), registry() === '{}');
    };

    try {
      console.log('');
      console.log('A. LEADER on_loaded() THROWS:');
      await run_scenario('a', 'throw_loaded');

      console.log('');
      console.log('B. LEADER on_load() SETS this.data = null:');
      await run_scenario('b', 'null_data', (leader, boot_errors) => {
        assert('the failure names the non-object this.data',
               boot_errors.some((m) => m.includes('on_load() left this.data as null')));
        let threw = false;
        try { leader.data.x = 1; } catch (e) { threw = true; }
        assert('the failed leader\'s this.data is still frozen', threw);
      });
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
