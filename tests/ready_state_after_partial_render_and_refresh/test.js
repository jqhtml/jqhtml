class Ready_State_After_Partial_Render_And_Refresh extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };

    // Every wait races an explicit deadline. A component that never becomes ready
    // again must show up as a FAILED assertion, never as a harness timeout.
    const settled = (promise, ms) => Promise.race([
      Promise.resolve(promise).then(() => true, () => false),
      new Promise((resolve) => setTimeout(() => resolve(false), ms))
    ]);
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const callback_count = (component, event) =>
      ((component._lifecycle_callbacks && component._lifecycle_callbacks.get(event)) || []).length;

    const stage = this.$sid('stage');
    const make_parent = () => $('<div>').component('Rs_Parent', {}).appendTo(stage).component();

    try {
      console.log('');
      console.log('A. render(sid) LEAVES THE PARENT READY:');
      const parent_a = make_parent();
      assert('the parent reaches ready', await settled(parent_a.ready(), 3000));

      // render('counter') delegates to the redrawable child and returns. The child
      // runs its own invalidate/trigger cycle; the parent's ready must survive.
      const partial = parent_a.render('counter');
      assert('parent.ready() still resolves after render(sid)', await settled(parent_a.ready(), 500));
      assert('the partial render itself completes', await settled(partial, 2000));
      assert('parent ready state is still 4 -> ' + parent_a._ready_state, parent_a._ready_state === 4);

      const counter = parent_a.sid('counter');
      assert('the redrawable child is ready too', await settled(counter.ready(), 500));

      console.log('');
      console.log('B. A QUIET refresh() LEAVES THE CHILD READY:');
      const parent_b = make_parent();
      assert('the parent reaches ready', await settled(parent_b.ready(), 3000));

      const poller = parent_b.sid('poller');
      const ready_calls_before = window.__rs_poller_ready_calls;

      assert('refresh #1 settles', await settled(poller.refresh(), 2000));
      assert('refresh #2 settles', await settled(poller.refresh(), 2000));

      assert('child.ready() resolves after two quiet refreshes', await settled(poller.ready(), 500));
      assert('child ready state restored -> ' + poller._ready_state, poller._ready_state === 4);
      assert('a quiet refresh did not call on_ready() -> ' +
             (window.__rs_poller_ready_calls - ready_calls_before),
             window.__rs_poller_ready_calls === ready_calls_before);

      // A parent re-entering _wait_for_children_ready() must not hang on a child
      // that was left mid-state by a quiet refresh.
      assert('the parent can render again', await settled(parent_b.render(), 2000));

      console.log('');
      console.log('C. REPEATED RENDER/READY CYCLES DO NOT GROW LISTENERS:');
      const parent_c = make_parent();
      assert('the parent reaches ready', await settled(parent_c.ready(), 3000));

      for (let i = 0; i < 20; i++) {
        const render_promise = parent_c.render();
        const ready_promise = parent_c.ready();   // registered mid-render, so it really waits
        await settled(render_promise, 3000);
        await settled(ready_promise, 3000);
      }

      const parent_cbs = callback_count(parent_c, 'ready');
      assert('parent ready callbacks after 20 cycles -> ' + parent_cbs, parent_cbs <= 1);

      const child_cbs = callback_count(parent_c.sid('poller'), 'ready');
      assert('child ready callbacks after 20 cycles -> ' + child_cbs, child_cbs <= 1);

      console.log('');
      console.log('D. A CHILD STOPPED MID-WAIT RELEASES THE PARENT:');
      window.__rs_poller_delay = 300;   // keep the fresh child in on_load() while we stop it
      const parent_d = make_parent();
      assert('the parent reaches ready', await settled(parent_d.ready(), 3000));

      const render_promise = parent_d.render();
      // The re-render replaces the children synchronously inside the queued
      // executor, so stopping the OUTGOING child would prove nothing - wait one
      // tick and stop the child the parent is actually waiting on.
      await sleep(30);
      const fresh_poller = parent_d.sid('poller');
      assert('a fresh child is mid-load -> ' + (fresh_poller && fresh_poller._ready_state),
             !!fresh_poller && fresh_poller._ready_state < 4);
      fresh_poller.stop();

      assert('render() resolves after the child is stopped', await settled(render_promise, 500));
      window.__rs_poller_delay = 0;
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
