class Coordinator_Error_And_Cleanup extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };

    const coordinator = window.jqhtml.Load_Coordinator;
    const registry = () => JSON.stringify(coordinator.get_registry_state());
    const cache_mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';

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
    const make_card = (args) => $('<div>').component('Coord_Card', args).appendTo(stage).component();

    try {
      console.log('');
      console.log('A. A LEADER on_load() FAILURE SETTLES ITS FOLLOWERS:');
      window.coord_fail_first[1] = true;

      const boot_errors = [];
      const original_error = console.error;
      console.error = (...a) => { boot_errors.push(a.map(String).join(' ')); original_error.apply(console, a); };

      make_card({ user_id: 1 });   // leader - its on_load() rejects
      make_card({ user_id: 1 });   // follower - must not wait forever
      const both_failed = await wait_until(
        () => boot_errors.filter((m) => /\[JQHTML Error\] Coord_Card#\w+ failed in boot/.test(m)).length >= 2,
        1000
      );
      console.error = original_error;

      assert('leader AND follower both settle within 1s', both_failed);
      assert('only the leader ran on_load() -> ' + window.coord_load_calls[1], window.coord_load_calls[1] === 1);
      assert('registry is empty after the leader error -> ' + registry(), registry() === '{}');

      console.log('');
      console.log('B. A LATER COMPONENT WITH THE SAME KEY BECOMES A NEW LEADER:');
      const retry_card = make_card({ user_id: 1 });
      const retry_ready = await settled(retry_card.ready(), 2000);
      assert('it reaches ready', retry_ready);
      assert('it ran on_load() itself -> ' + window.coord_load_calls[1], window.coord_load_calls[1] === 2);
      assert('it loaded real data -> ' + retry_card.data.label, retry_card.data.label === 'User 1');

      console.log('');
      console.log('C. A LEADER WITH NO FOLLOWERS LEAVES NO ENTRY BEHIND:');
      const lone_card = make_card({ user_id: 2 });
      const lone_ready = await settled(lone_card.ready(), 2000);
      assert('the lone leader reaches ready', lone_ready);
      assert('registry has no entry for it -> ' + registry(), registry() === '{}');

      console.log('');
      console.log('D. ARGS CHANGED AFTER REGISTRATION STILL RESOLVE TO THE LEADER:');
      const parent = $('<div>').component('Coord_Parent', { user_id: 3 }).appendTo(stage).component();
      const parent_ready = await settled(parent.ready(), 3000);
      assert('parent reaches ready', parent_ready);

      const cards = parent.$.find('.Coord_Card').toArray().map((el) => $(el).component());
      const [card_a, card_b, card_c, card_d] = cards;
      assert('the parent rendered four cards -> ' + cards.length, cards.length === 4);

      assert('the parent really did change child_b args -> ' + card_b.args.filter, card_b.args.filter === 'x');
      assert('one on_load() for the whole group -> ' + window.coord_load_calls[3], window.coord_load_calls[3] === 1);
      assert('child_b got the LEADER data, not stale on_create() data -> ' + card_b.data.label,
             card_b.data.label === 'User 3' && card_b.data.seq === card_a.data.seq);
      assert('registry is empty once the group finished -> ' + registry(), registry() === '{}');

      console.log('');
      console.log('E. EVERY COMPONENT OWNS ITS DATA OBJECT (cache mode ' + cache_mode + '):');
      // Data cache mode re-normalizes every component's data through a
      // serialize/deserialize round trip, which would hide a shared reference. The
      // html run is the one that actually proves it.
      assert('leader and follower do not share this.data', card_a.data !== card_b.data);
      assert('two followers do not share one nested object',
             card_c.data.nested !== card_d.data.nested && card_c.data.nested.id === card_d.data.nested.id);
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
