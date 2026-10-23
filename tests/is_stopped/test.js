class Test_Is_Stopped extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const stage = this.$sid('stage');
    const mount = () => $('<div>').appendTo(stage).component('Ist_Page', {}).component();
    const hold = () => { let release; window.__ist_gate = new Promise((r) => { release = r; }); return () => { window.__ist_gate = null; release(); }; };

    try {
      console.log('');
      console.log('A. FALSE THROUGH BOOT, READY, render() AND reload()');
      const release = hold();
      const p = mount();
      await sleep(20);
      assert('false while boot is held in on_load()', p.is_stopped() === false);
      release();
      await p.ready();
      const seen = p.state.seen;
      assert('false in on_create/on_render/on_loaded/on_ready -> ' + JSON.stringify(seen),
        seen.create === false && seen.render === false && seen.loaded === false && seen.ready === false);
      assert('false after ready', p.is_stopped() === false);
      await p.render();
      assert('false after render()', p.is_stopped() === false);
      await p.reload();
      assert('false after reload()', p.is_stopped() === false);
      assert('child false', p.sid('child').is_stopped() === false);

      console.log('');
      console.log('B. stop(): TRUE INSIDE on_stop() AND AFTER, ON EVERY DESCENDANT');
      const child = p.sid('child');
      const leaf = child.sid('leaf');
      p.stop();
      assert('true inside on_stop()', p.state.stopped_in_on_stop === true);
      assert('true after stop() returns', p.is_stopped() === true);
      assert('child true', child.is_stopped() === true);
      assert('grandchild true', leaf.is_stopped() === true);
      assert('descendants saw true in their own on_stop()',
        child.state.stopped_in_on_stop === true && leaf.state.stopped_in_on_stop === true);

      console.log('');
      console.log('C. STOPPED WHILE ITS ELEMENT IS STILL IN THE DOM');
      assert('element still in the document', p.$[0].isConnected === true);
      assert('is_stopped() true, is_attached() false', p.is_stopped() === true && p.is_attached() === false);
      p.$.parent().remove();
      assert('stays true after removal', p.is_stopped() === true);

      console.log('');
      console.log('D. A DETACHED LIVE COMPONENT IS NOT STOPPED');
      const q = mount();
      await q.ready();
      q.$.detach();
      assert('detached: is_attached() false, is_stopped() false', q.is_attached() === false && q.is_stopped() === false);
      q.$.appendTo(stage);

      console.log('');
      console.log('E. STOPPED BY A jQuery REMOVAL AND BY A PARENT RE-RENDER');
      const old_child = q.sid('child');
      await q.render();
      assert('child replaced by the re-render is stopped', old_child.is_stopped() === true);
      assert('the new child is live', q.sid('child').is_stopped() === false);
      q.$.remove();
      assert('.remove() stops it', q.is_stopped() === true);

      console.log('');
      console.log('F. AN await ready() RELEASED BY A STOP SEES is_stopped() TRUE');
      const release2 = hold();
      const r = mount();
      const waited = r.ready().then(() => r.is_stopped());
      await sleep(20);
      r.stop();
      assert('the awaiter sees true', (await waited) === true);
      release2();
      await sleep(20);
      assert('still true after the held load settles', r.is_stopped() === true);
      r.$.remove();

      console.log('');
      console.log('G. NOT AVAILABLE IN on_load() / on_load_error(): A SPECIFIC ERROR');
      const probe = $('<div>').appendTo(stage).component('Ist_Probe', {}).component();
      await probe.ready();
      const tried = window.__ist_probe_on_load || {};
      assert('is_stopped() in on_load() throws its own error -> ' + tried.is_stopped,
        /Cannot call this\.is_stopped\(\) during on_load\(\)/.test(tried.is_stopped));
      assert('is_attached() in on_load() throws its own error -> ' + tried.is_attached,
        /Cannot call this\.is_attached\(\) during on_load\(\)/.test(tried.is_attached));
      assert('is_stopped() in on_load_error() throws too -> ' + probe.data.in_on_load_error,
        /Cannot call this\.is_stopped\(\) during on_load_error\(\)/.test(probe.data.in_on_load_error));
      probe.$.remove();
    } catch (e) {
      assert('no exception: ' + e.message, false);
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    window.testPassed = (failed === 0);
  }
}
