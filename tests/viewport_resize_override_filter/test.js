// on_viewport_resize() override filter
//
// The lifecycle fire (after on_render / on_ready) and the window resize dispatcher skip
// a component whose hook is still the base no-op. This test pins down that nothing a
// component can observe changed: the lifecycle calls, resize calls in document order
// (parents before children), stopped and detached components skipped, and per-instance
// hooks (assigned in on_create, assigned later from outside, class fields, a prototype
// patched after instances exist) still called.
//
// Runs in all three cache modes; every count is a delta.

class Viewport_Resize_Override_Filter_Test extends Jqhtml_Component {
  on_create() {
    window.__vrr = { log: [], armed: false, victim: null };
  }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    let n = 0;
    function check(label, condition) {
      n++;
      console.log('');
      console.log(n + '. ' + label + ':');
      if (condition) { console.log('   PASS'); passed++; }
      else { console.log('   FAIL'); failed++; }
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const vrr = window.__vrr;
    const $arena = this.$sid('arena');
    const resize = async () => { window.dispatchEvent(new Event('resize')); await sleep(200); };
    const mark = () => vrr.log.length;
    const since = (m) => vrr.log.slice(m);
    const keys = (entries) => entries.map((e) => e.key);
    const make = async (name, key, $where) => {
      const $el = $('<div>');
      if ($where) $el.appendTo($where); else $el.appendTo($arena);
      const c = $el.component(name, { key }).component();
      await c.ready();
      return c;
    };

    // ======================================================================
    // A) Non-overriding components keep the base stub
    // ======================================================================
    const plains = [];
    for (let i = 0; i < 5; i++) plains.push(await make('Vrr_Plain', 'p' + i));
    check('A: a component class without an override inherits the base stub',
      plains[0].on_viewport_resize === Jqhtml_Component.prototype.on_viewport_resize);

    let m = mark();
    const h1 = await make('Vrr_Hooked', 'h1');

    // ======================================================================
    // B) Lifecycle call points unchanged
    // ======================================================================
    const h1_life = since(m).filter((e) => e.key === 'h1');
    check('B: called after on_render() and after on_ready(), in that order',
      h1_life.length >= 2 &&
      h1_life[0].phase === 'render' &&
      h1_life[h1_life.length - 1].phase === 'ready');
    check('B: lifecycle calls carry window.innerWidth',
      h1_life.every((e) => e.width === window.innerWidth));

    m = mark();
    await h1.render();
    await sleep(30);
    const rerender = since(m);
    check('B: render() calls the hook again after on_render() and on_ready()',
      keys(rerender).filter((k) => k === 'h1').length >= 2 &&
      rerender.some((e) => e.key === 'h1' && e.phase === 'render') &&
      rerender.some((e) => e.key === 'h1' && e.phase === 'ready'));

    // ======================================================================
    // C) Resize dispatch: document order, parents before children
    // ======================================================================
    const h2 = await make('Vrr_Hooked', 'h2');
    // Created last, but placed FIRST in the document: dispatch order is document
    // order, not registration order.
    const $first = $('<div>').prependTo($arena);
    const h0 = $first.component('Vrr_Hooked', { key: 'h0' }).component();
    await h0.ready();
    const nest = await make('Vrr_Nest', 'n');

    m = mark();
    await resize();
    let got = keys(since(m));
    check('C: one resize calls each live overriding component exactly once',
      got.length === 5 && new Set(got).size === 5);
    check('C: calls follow document order (not creation order)',
      JSON.stringify(got) === JSON.stringify(['h0', 'h1', 'h2', 'n.a', 'n.b']));
    check('C: resize calls carry window.innerWidth and are tagged resize',
      since(m).every((e) => e.width === window.innerWidth && e.phase === 'resize'));

    // ======================================================================
    // D) Per-instance hooks
    // ======================================================================
    m = mark();
    const as1 = await make('Vrr_Assigned', 'as1');
    const as_life = since(m).filter((e) => e.key === 'as1');
    check('D: hook assigned in on_create() is called after on_render() and on_ready()',
      as_life.length >= 2 && as_life[0].phase === 'render' &&
      as_life[as_life.length - 1].phase === 'ready');

    const f1 = await make('Vrr_Field', 'f1');

    // Assigned from outside the lifecycle, after ready, on a component whose class
    // has no hook: no render follows, so only the dispatcher can reach it.
    const late = plains[2];
    late.on_viewport_resize = function(viewport_width) {
      window.__vrr.log.push({ key: 'late', phase: 'late', width: viewport_width });
    };

    m = mark();
    await resize();
    got = keys(since(m));
    check('D: hook assigned in on_create() is called on resize', got.includes('as1'));
    check('D: hook defined as a class field is called on resize', got.includes('f1'));
    check('D: hook assigned to a live instance later is called on resize', got.includes('late'));
    check('D: per-instance hooks keep document order',
      JSON.stringify(got) === JSON.stringify(['h0', 'late', 'h1', 'h2', 'n.a', 'n.b', 'as1', 'f1']));

    // ======================================================================
    // E) Stopped components
    // ======================================================================
    h2.stop();
    m = mark();
    await resize();
    got = keys(since(m));
    check('E: a stopped component is not called on resize', !got.includes('h2'));
    check('E: its live siblings still are', got.includes('h1') && got.includes('h0'));

    nest.stop();
    m = mark();
    await resize();
    got = keys(since(m));
    check('E: stopping a parent stops resize calls to its overriding children',
      !got.includes('n.a') && !got.includes('n.b') && got.includes('h1'));

    // A handler that stops a component later in document order prevents its call.
    const $s = $('<div>').insertBefore(h0.$);
    const stopper = $s.component('Vrr_Stopper', { key: 'st' }).component();
    await stopper.ready();
    vrr.victim = h1;
    vrr.armed = true;
    m = mark();
    await resize();
    vrr.armed = false;
    got = keys(since(m));
    check('E: component stopped by an earlier handler in the same dispatch is not called',
      got[0] === 'st' && !got.includes('h1') && got.includes('h0'));

    // ======================================================================
    // F) Detached components
    // ======================================================================
    h0.$.detach();
    m = mark();
    await resize();
    got = keys(since(m));
    check('F: a component detached with jQuery .detach() is not called', !got.includes('h0'));

    as1.$[0].remove();
    m = mark();
    await resize();
    got = keys(since(m));
    check('F: a component removed natively is not called', !got.includes('as1') && !got.includes('h0'));

    h0.$.appendTo($arena);
    m = mark();
    await resize();
    got = keys(since(m));
    check('F: a detached component re-inserted is called again', got.includes('h0'));
    check('F: a natively removed one stays uncalled', !got.includes('as1'));

    // ======================================================================
    // G) A prototype patched after instances exist
    // ======================================================================
    const Plain_Class = plains[0].constructor;
    Plain_Class.prototype.on_viewport_resize = function(viewport_width) {
      window.__vrr.log.push({ key: 'proto:' + this.args.key, phase: 'proto', width: viewport_width });
    };
    m = mark();
    await resize();
    got = keys(since(m));
    delete Plain_Class.prototype.on_viewport_resize;
    check('G: live instances of a class patched later are called on resize',
      ['p0', 'p1', 'p3', 'p4'].every((k) => got.includes('proto:' + k)));
    check('G: an instance-level hook still shadows the patched prototype',
      got.includes('late') && !got.includes('proto:p2'));

    // ======================================================================
    // H) Nothing after stop
    // ======================================================================
    for (const c of [h0, as1, f1, stopper, late, ...plains]) if (!c._stopped) c.stop();
    m = mark();
    await resize();
    check('H: no created component is called after being stopped', since(m).length === 0);

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    if (failed === 0) console.log('ALL TESTS PASSED');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
