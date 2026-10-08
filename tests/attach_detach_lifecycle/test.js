class Attach_Detach_Test extends Jqhtml_Component {
  async on_ready() {
    let passed = 0, failed = 0;
    const assert = (name, condition) => {
      if (condition) { console.log('   PASS: ' + name); passed++; }
      else { console.log('   FAIL: ' + name); failed++; }
    };
    const tick = () => new Promise(r => setTimeout(r, 20));
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const $arena = this.$sid('arena');

    // --- 1. Born attached: 'attach' fires after on_ready, hook runs, sticky for late subscribers
    const $w1 = $('<div>').appendTo($arena).component('Watched_Widget', { label: 'one' });
    const w1 = $w1.component();
    await w1.ready();
    assert('attach fires after on_ready (hook order)', same(w1.state.log, ['ready', 'on_attach']));
    assert('is_attached() true once attached', w1.is_attached() === true);
    let late = 0;
    w1.on('attach', () => late++);
    assert('late .on(attach) gets the sticky fire', late === 1);
    assert('observer installed for tracked component', jqhtml.attachment_observer_active() === true);

    // --- 2. jQuery .detach(): detach event, NO stop; reinsert: attach again, exactly once each
    $w1.detach();
    await tick();
    assert('.detach() fires on_detach, not on_stop', same(w1.state.log, ['ready', 'on_attach', 'on_detach']));
    assert('is_attached() false after detach', w1.is_attached() === false);
    let late_detach = 0;
    w1.on('detach', () => late_detach++);
    assert('late .on(detach) gets the sticky fire while detached', late_detach === 1);
    $w1.appendTo($arena);
    await tick();
    assert('reinsert fires on_attach again', same(w1.state.log, ['ready', 'on_attach', 'on_detach', 'on_attach']));
    assert('attach listener fired for the reinsert (sticky + live)', late === 2);
    await tick();
    assert('no duplicate transitions on later mutation batches', w1.state.log.length === 4);

    // --- 3. Synchronous move within the document: no transition at all
    const $other = $('<div>').appendTo($arena);
    $w1.appendTo($other);
    await tick();
    assert('synchronous move produces no attach/detach', w1.state.log.length === 4);

    // --- 4. stop() on an attached component: detach precedes on_stop
    w1.stop();
    assert('stop() fires detach before on_stop',
      same(w1.state.log, ['ready', 'on_attach', 'on_detach', 'on_attach', 'on_detach', 'on_stop']));
    assert('is_attached() false after stop', w1.is_attached() === false);
    $w1.remove();
    await tick();
    assert('observer released once nothing is tracked', jqhtml.attachment_observer_active() === false);

    // --- 5. jQuery .remove() stops a component (cleanData hook), including descendants
    const $p1 = $('<div>').appendTo($arena).component('Plain_Widget', { label: 'p1' });
    const p1 = $p1.component();
    await p1.ready();
    let stop_evt = 0;
    p1.on('stop', () => stop_evt++);
    $p1.remove();
    assert('.remove() runs on_stop', same(p1.state.log, ['on_stop']));
    assert('.remove() fires stop event', stop_evt === 1);
    assert('sticky attach is invalidated by the detach that precedes stop',
      p1._lifecycle_states.has('attach') === false);

    // --- 6. .replaceWith() and ancestor .remove() reach descendants
    const $wrap = $('<div><div class="inner"></div></div>').appendTo($arena);
    const p2 = $wrap.find('.inner').component('Plain_Widget', { label: 'p2' }).component();
    await p2.ready();
    $wrap.replaceWith('<div>replaced</div>');
    assert('.replaceWith() on an ancestor stops the descendant component', same(p2.state.log, ['on_stop']));

    const $wrap2 = $('<div><div class="inner"></div></div>').appendTo($arena);
    const p3 = $wrap2.find('.inner').component('Plain_Widget', { label: 'p3' }).component();
    await p3.ready();
    $wrap2.remove();
    assert('.remove() on an ancestor stops the descendant component', same(p3.state.log, ['on_stop']));

    // --- 7. .empty() / .html() / .text() still stop children (now via cleanData)
    const $c = this.$sid('container');
    const mk = async (label) => { const c = $('<div>').appendTo($c).component('Plain_Widget', { label }).component(); await c.ready(); return c; };
    const e1 = await mk('e1'); $c.empty();
    assert('.empty() stops children', same(e1.state.log, ['on_stop']));
    const e2 = await mk('e2'); $c.html('<b>x</b>');
    assert('.html(x) stops children', same(e2.state.log, ['on_stop']));
    const e3 = await mk('e3'); $c.text('y');
    assert('.text(x) stops children', same(e3.state.log, ['on_stop']));
    assert('.html() getter still works', typeof $c.html() === 'string');

    // --- 8. Plain widget, late interest after native removal: detach is seen on subscription
    const $p4 = $('<div>').appendTo($arena).component('Plain_Widget', { label: 'p4' });
    const p4 = $p4.component();
    await p4.ready();
    assert('untracked component still records attached after ready', p4.is_attached() === true);
    assert('untracked component installs no observer', jqhtml.attachment_observer_active() === false);
    $p4[0].remove();                 // native removal: no cleanData, no stop
    await tick();
    assert('native removal does not stop (documented hole)', p4.state.log.length === 0);
    let p4_detach = 0;
    p4.on('detach', () => p4_detach++);
    assert('late .on(detach) after native removal fires detach immediately', p4_detach === 1 && p4.is_attached() === false);
    assert('late interest installs the observer', jqhtml.attachment_observer_active() === true);
    $p4.appendTo($arena);
    await tick();
    assert('reinsert after native removal fires attach', p4.is_attached() === true);
    p4.stop();
    assert('stop of re-attached fires detach again', p4_detach === 2);

    // --- 9. Born detached with interest: attach only when inserted
    const $w2 = $('<div>').component('Watched_Widget', { label: 'two' });
    const w2 = $w2.component();
    await w2.ready();
    assert('born detached: no attach after ready', same(w2.state.log, ['ready']) && w2.is_attached() === false);
    $w2.appendTo($arena);
    await tick();
    assert('born detached: attach once inserted', same(w2.state.log, ['ready', 'on_attach']));
    w2.stop();
    assert('stop sequence for formerly detached widget', same(w2.state.log, ['ready', 'on_attach', 'on_detach', 'on_stop']));

    // --- 10. Parent re-render stops children (detach precedes stop for tracked child)
    const $host = $('<div>').appendTo($arena);
    $host.append('<div class="k"></div>');
    const k = $host.find('.k').component('Watched_Widget', { label: 'k' }).component();
    await k.ready();
    $host.empty();
    assert('.empty() on a tracked child: detach then stop',
      same(k.state.log, ['ready', 'on_attach', 'on_detach', 'on_stop']));
    await tick();
    assert('tracker count is zero at the end', jqhtml.tracked_attachment_count() === 0);

    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
