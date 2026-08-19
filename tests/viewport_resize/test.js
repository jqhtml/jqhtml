// on_viewport_resize() feature test
//
// Covers the viewport hook added to @jqhtml/core: a base no-op stub on
// Jqhtml_Component, two automatic calls per lifecycle (after on_render and after
// on_ready), and a single framework-owned window 'resize' listener debounced 30ms
// that fans out to every component in the document. See README.md.
//
// Chromium via the test runner exposes no viewport control, so resizes are driven
// with synthetic window 'resize' events and window.innerWidth is stubbed to prove
// the width argument is read at dispatch time.
//
// Runs in all three cache modes: every count assertion is a delta, so the extra
// on_render that html cache mode performs cannot skew a result.

class Viewport_Resize_Test extends Jqhtml_Component {
  on_create() {
    window.__vr = { thrown: 0, root: [] };
  }

  on_render() {
    this.state.phase = 'render';
  }

  on_viewport_resize(viewport_width) {
    window.__vr.root.push({ width: viewport_width, phase: this.state.phase || 'resize' });
    this.state.phase = 'resize';
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
      if (condition) {
        console.log('   PASS');
        passed++;
      } else {
        console.log('   FAIL');
        failed++;
      }
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const vr = window.__vr;

    // Snapshot the number of calls each component has received so far.
    const snap = () => ({
      root: vr.root.length,
      alpha: vr.alpha.length,
      beta: vr.beta.length,
      gamma: vr.gamma.length,
      thrown: vr.thrown
    });

    // Fire a burst of resize events and wait past the 30ms debounce window.
    const burst = async (count) => {
      for (let i = 0; i < count; i++) window.dispatchEvent(new Event('resize'));
      await sleep(200);
    };

    const last = (key) => vr[key][vr[key].length - 1];

    // ========================================================================
    // A) Base class stub
    // ========================================================================
    check('A: Jqhtml_Component defines on_viewport_resize()',
      typeof Jqhtml_Component.prototype.on_viewport_resize === 'function');

    check('A: base on_viewport_resize() is a no-op',
      Jqhtml_Component.prototype.on_viewport_resize.call({}, 100) === undefined);

    check('A: component without an override inherits the base stub',
      this.sid('plain').on_viewport_resize === Jqhtml_Component.prototype.on_viewport_resize);

    // ========================================================================
    // B) Automatic lifecycle calls (after on_render, after on_ready)
    // ========================================================================
    check('B: hook fired after on_render()',
      vr.alpha.some((c) => c.phase === 'render'));

    check('B: hook fired after on_ready()',
      vr.alpha.some((c) => c.phase === 'ready'));

    check('B: parent also received its post-on_render call',
      vr.root.some((c) => c.phase === 'render'));

    // ========================================================================
    // C) Width argument
    // ========================================================================
    check('C: width argument is the live window.innerWidth',
      vr.alpha.length > 0 && vr.alpha.every((c) => c.width === window.innerWidth));

    check('C: width argument is a positive number',
      vr.alpha.every((c) => typeof c.width === 'number' && c.width > 0));

    // ========================================================================
    // D) Debounce and fan-out
    // ========================================================================
    const before_burst = snap();
    await burst(5);
    const after_burst = snap();

    check('D: 5 rapid resize events produce exactly 1 call (30ms debounce)',
      after_burst.alpha - before_burst.alpha === 1);

    check('D: fan-out reached the parent and every live child',
      after_burst.root - before_burst.root === 1 &&
      after_burst.beta - before_burst.beta === 1 &&
      after_burst.gamma - before_burst.gamma === 1);

    check('D: resize-driven calls are tagged resize, not a lifecycle phase',
      last('alpha').phase === 'resize');

    // ========================================================================
    // E) A throwing handler does not break the fan-out
    // ========================================================================
    check('E: the throwing component did run',
      after_burst.thrown - before_burst.thrown === 1);

    check('E: components after the thrower in document order still received the call',
      after_burst.beta - before_burst.beta === 1 &&
      after_burst.gamma - before_burst.gamma === 1);

    // ========================================================================
    // F) Width is re-read at dispatch time
    // ========================================================================
    const real_width = window.innerWidth;
    const real_desc = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => 640 });

    await burst(1);
    check('F: stubbed viewport width is delivered to the hook',
      last('alpha').width === 640 && last('beta').width === 640);

    if (real_desc) Object.defineProperty(window, 'innerWidth', real_desc);
    else delete window.innerWidth;
    check('F: native window.innerWidth restored',
      window.innerWidth === real_width);

    // ========================================================================
    // G) Stopped components are skipped
    // ========================================================================
    this.sid('gamma').stop();

    const before_stop = snap();
    await burst(1);
    const after_stop = snap();

    check('G: a stopped component receives no further calls',
      after_stop.gamma - before_stop.gamma === 0);

    check('G: its live siblings still do',
      after_stop.alpha - before_stop.alpha === 1 &&
      after_stop.beta - before_stop.beta === 1);

    // ========================================================================
    // H) Re-render fires the hook again
    // ========================================================================
    const before_render = snap();
    await this.sid('beta').render();
    await sleep(50);
    const after_render = snap();

    check('H: render() fires the hook again (on_render and on_ready)',
      after_render.beta - before_render.beta >= 2);

    check('H: re-rendering one component does not call the hook on others',
      after_render.alpha - before_render.alpha === 0);

    // ========================================================================
    // SUMMARY
    // ========================================================================
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
