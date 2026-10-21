class Stopped_Component_Lifecycle extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };

    const log = window.stop_log;
    const has = (entry) => log.includes(entry);
    const count = (prefix) => log.filter((e) => e.startsWith(prefix)).length;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const registry = () => JSON.stringify(window.jqhtml.Load_Coordinator.get_registry_state());

    // Every wait races a deadline: a hang is a failed assertion, not a harness timeout.
    const settled = (promise, ms) => Promise.race([
      Promise.resolve(promise).then(() => true, () => false),
      new Promise((resolve) => setTimeout(() => resolve(false), ms))
    ]);

    // Nothing here sleeps for a duration and assumes where the lifecycle has got to:
    // hold_load(tag) parks a component's on_load() until the test releases it
    // (__hold_or_delay in the component files), and settle() waits a few event-loop
    // turns - ordering, not time - so every check holds under any system load.
    const hold_load = (tag) => {
      const hold = {};
      hold.parked = new Promise((resolve) => { hold.entered = resolve; });
      hold.released = new Promise((resolve) => { hold.release = resolve; });
      hold.done = new Promise((resolve) => { hold.finished = resolve; });
      (window.__load_holds = window.__load_holds || {})[tag] = hold;
      return hold;
    };
    const settle = async () => { for (let i = 0; i < 5; i++) await sleep(0); };

    const stage = this.$sid('stage');
    const make = (name, args) => $('<div>').component(name, args || {}).appendTo(stage).component();

    // A component that is stopped records every 'ready'/'loaded' event it fires.
    const watch = (component) => {
      const fired = [];
      component.on('ready', () => fired.push('ready'));
      component.on('loaded', () => fired.push('loaded'));
      return fired;
    };

    try {
      console.log('');
      console.log('A. CHILD STOPPED BY REMOVING ITS ELEMENT WHILE WAITING FOR ITS CHILDREN:');
      {
        const grand_hold = hold_load('grand');
        const parent = make('Stop_Wait_Parent');
        await grand_hold.parked;   // child rendered, its grandchild held in on_load()
        const old_child = parent.$sid('child').component();
        const old_cid = old_child._cid;
        const fired = watch(old_child);
        assert('the child is still waiting (ready_state < 4) before the removal',
               old_child._ready_state < 4);

        // The real-world path: a jQuery removal stops the component (jQuery.cleanData hook).
        old_child.$.remove();
        assert('the child was stopped by the removal', has('child_on_stop:' + old_cid));

        grand_hold.release();
        await grand_hold.done;     // the old grandchild's on_load() has finished
        await settle();
        assert('the stopped child never ran on_ready()', !has('child_on_ready:' + old_cid));
        assert('the stopped child never fired ready', !fired.includes('ready'));
        // stop() sets 99; the defect overwrote it with 4 after on_ready()
        assert('the stopped child\'s ready_state stays at the stopped value -> ' + old_child._ready_state,
               old_child._ready_state === 99);

        assert('the parent that was waiting on the child reaches ready', await settled(parent.ready(), 2000));
      }

      console.log('');
      console.log('B. COMPONENT REMOVED MID-FETCH (dedup leader with no followers):');
      {
        const hold = hold_load('card:b');
        const card = make('Stop_Load_Card', { key: 'b' });
        const fired = watch(card);
        await hold.parked;
        assert('on_load() started', has('card_on_load:b'));
        card.stop();
        hold.release();
        await hold.done;
        await settle();
        assert('on_loaded() never ran', count('card_on_loaded:b:') === 0);
        assert('on_ready() never ran', count('card_on_ready:b:') === 0);
        assert('no loaded/ready event fired -> ' + fired.join(','), fired.length === 0);
        assert('the fetched data was not applied', card.data.label === undefined);
        assert('registry is empty -> ' + registry(), registry() === '{}');
      }

      console.log('');
      console.log('C. COMPONENT REMOVED MID-FETCH (no dedup key):');
      {
        const hold = hold_load('card:c');
        const card = make('Stop_Load_Card', { key: 'c', fn: () => 1 });
        const fired = watch(card);
        await hold.parked;
        assert('on_load() started', has('card_on_load:c'));
        card.stop();
        hold.release();
        await hold.done;
        await settle();
        assert('on_loaded() never ran', count('card_on_loaded:c:') === 0);
        assert('no loaded/ready event fired -> ' + fired.join(','), fired.length === 0);
      }

      console.log('');
      console.log('D. DEDUP LEADER STOPPED MID-FETCH WITH TWO FOLLOWERS:');
      {
        const hold = hold_load('card:d');
        const leader = make('Stop_Load_Card', { key: 'd' });
        const follower_1 = make('Stop_Load_Card', { key: 'd' });
        const follower_2 = make('Stop_Load_Card', { key: 'd' });
        await hold.parked;
        leader.stop();
        hold.release();
        const both = Promise.all([follower_1.ready(), follower_2.ready()]);
        assert('both followers reach ready', await settled(both, 2000));
        await settle();
        assert('only the leader ran on_load() -> ' + count('card_on_load:d'), count('card_on_load:d') === 1);
        assert('followers received the leader\'s data',
               follower_1.data.label === 'Key d' && follower_2.data.label === 'Key d');
        assert('the stopped leader never ran on_loaded()', !has('card_on_loaded:d:' + leader._cid));
        assert('the stopped leader did not take the data', leader.data.label === undefined);
        assert('both followers ran on_loaded()',
               has('card_on_loaded:d:' + follower_1._cid) && has('card_on_loaded:d:' + follower_2._cid));
        assert('registry is empty -> ' + registry(), registry() === '{}');
      }

      console.log('');
      console.log('E. DEDUP FOLLOWER STOPPED WHILE WAITING:');
      {
        const hold = hold_load('card:e');
        const leader = make('Stop_Load_Card', { key: 'e' });
        const follower = make('Stop_Load_Card', { key: 'e' });
        const fired = watch(follower);
        await hold.parked;
        follower.stop();
        hold.release();
        assert('the leader reaches ready', await settled(leader.ready(), 2000));
        await settle();
        assert('the stopped follower never ran on_loaded()', !has('card_on_loaded:e:' + follower._cid));
        assert('the stopped follower fired no loaded/ready -> ' + fired.join(','), fired.length === 0);
        assert('registry is empty -> ' + registry(), registry() === '{}');
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
    console.log('');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
