/**
 * sid_guard_hand_written_data_sid
 *
 * The jQuery plugin rejects an element with a hand-written data-sid (one not paired
 * with the scoped "<sid>:<cid>" id the template renderer emits), at creation and at
 * insertion, and leaves everything else alone (packages/core/src/jquery-plugin.ts).
 *
 * Moved here from packages/core/test/sid-guard-test.mjs, a standalone node script that
 * no suite ran (and that could no longer load: it imported dist/jquery-plugin.js, which
 * the rollup build does not emit). Same cases, run in the browser.
 */
class Test_Sid_Guard extends Jqhtml_Component {
  on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    const check = (label, fn, should_throw) => {
      let threw = false;
      let msg = '';
      try { fn(); } catch (e) { threw = true; msg = e.message; }
      // When a throw is expected it must be the guard's ([JQHTML] ... data-sid ...)
      const right_error = !should_throw || (msg.startsWith('[JQHTML]') && msg.includes('data-sid'));
      if (threw === should_throw && right_error) {
        passed++;
        console.log('   PASS: ' + label);
      } else {
        failed++;
        console.log('   FAIL: ' + label + ' (threw=' + threw + ', expected=' + should_throw + ')' +
          (msg ? ' ' + msg.split('\n')[0] : ''));
      }
    };

    const $root = this.$sid('root');

    console.log('');
    console.log('1. MUST THROW - hand-written data-sid:');
    check(".html('<div data-sid=\"items_container\">')",
      () => $root.html('<div class="entity-chips" data-sid="items_container"></div>'), true);
    check("$('<div data-sid=\"x\">') construction", () => $('<div data-sid="x"></div>'), true);
    check(".append('<span data-sid=\"y\">')", () => $root.append('<span data-sid="y"></span>'), true);
    check(".prepend('<i data-sid=\"z\">')", () => $root.prepend('<i data-sid="z"></i>'), true);
    check(".after('<b data-sid=\"w\">')", () => $root.after('<b data-sid="w"></b>'), true);
    check(".replaceWith('<u data-sid=\"v\">')", () => $root.replaceWith('<u data-sid="v"></u>'), true);
    check('nested data-sid in html', () => $root.html('<ul><li data-sid="row"></li></ul>'), true);

    console.log('');
    console.log('2. MUST NOT THROW:');
    // Framework format: data-sid paired with its scoped id is legitimate output
    check('provisioned id + data-sid (framework render output)',
      () => $('<div></div>').html('<div id="items_container:cid123" data-sid="items_container"></div>'), false);
    check('plain html, no data-sid', () => $('<div></div>').html('<div class="foo">hi</div>'), false);
    check('.html() getter', () => $root.html(), false);
    check("normal selector $('#app')", () => $('#app'), false);
    check("$('<div>') plain element creation", () => $('<div class="x"></div>'), false);

    console.log('');
    console.log('3. NOTHING WAS INSERTED:');
    // Native query: jqhtml rejects a [data-sid] selector passed to jQuery
    const stray = Array.from(this.$[0].querySelectorAll('[data-sid]'))
      .filter((el) => (el.getAttribute('id') || '').indexOf(el.getAttribute('data-sid') + ':') !== 0).length;
    check('no hand-written data-sid element reached the DOM', () => {
      if (stray !== 0) throw new Error(stray + ' stray element(s)');
    }, false);

    console.log('');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
