class Extends_Js_Class_Conflict extends Jqhtml_Component {
  on_create() {
    // Patch console.error here, not in on_ready(): the children are declared in this
    // template, so they boot (and the conflicting ones fail) during this component's
    // _render(), before on_ready().
    this.state.errors = [];
    this.state.started_at = Date.now();
    this.state.real_console_error = console.error;
    console.error = (...args) => {
      this.state.errors.push(args.map(a => (a && a.message) ? a.message : String(a)).join(' '));
      this.state.real_console_error.apply(console, args);
    };
  }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    const elapsed = Date.now() - this.state.started_at;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const settled = (promise, ms) => Promise.race([
      Promise.resolve(promise).then(() => true, () => false),
      new Promise((resolve) => setTimeout(() => resolve(false), ms))
    ]);

    // A child that rendered cleanly: not stopped, and showing exactly one parent marker.
    const markers = (c) => ['a', 'b', 'mid', 'own'].filter(m => c.$.find('.ejc-' + m + '-marker').length > 0).join(',');
    const healthy = (sid, expected_marker) => {
      const c = this.sid(sid);
      assert(sid + ' is not stopped', !!c && c._stopped !== true);
      assert(sid + ' rendered marker [' + expected_marker + '] -> [' + (c ? markers(c) : 'none') + ']',
             !!c && markers(c) === expected_marker);
    };
    const errors_naming = (name) => this.state.errors.filter(e => e.includes(name));

    try {
      console.log('');
      console.log('A. extends= NAMING A TEMPLATE THE CLASS DOES NOT DESCEND FROM THROWS:');
      // Pre-fix: Ejc_Conflict silently rendered Ejc_Grid_A's markup over Ejc_Grid_B's methods.
      const conflict = this.sid('conflict');
      const conflict_errors = errors_naming('Ejc_Conflict').join('\n');
      assert('an error naming Ejc_Conflict reached console.error', conflict_errors.length > 0);
      assert('it names the extends= target Ejc_Grid_A', /extends="Ejc_Grid_A"/.test(conflict_errors));
      assert('it names the templated JS ancestor Ejc_Grid_B', /Ejc_Grid_B/.test(conflict_errors));
      assert('Ejc_Conflict is stopped', !!conflict && conflict._stopped === true);
      assert('Ejc_Conflict is marked _Component_Stopped', !!conflict && conflict.$.hasClass('_Component_Stopped'));
      assert('Ejc_Conflict did not render Ejc_Grid_A\'s markup', !!conflict && conflict.$.find('.ejc-a-marker').length === 0);

      console.log('');
      console.log('B. A FULL TEMPLATE WITH A CONFLICTING extends= THROWS TOO:');
      const full_conflict = this.sid('full_conflict');
      const full_errors = errors_naming('Ejc_Full_Conflict').join('\n');
      assert('an error naming Ejc_Full_Conflict, Ejc_Grid_A and Ejc_Grid_B',
             /Ejc_Grid_A/.test(full_errors) && /Ejc_Grid_B/.test(full_errors));
      assert('Ejc_Full_Conflict is stopped', !!full_conflict && full_conflict._stopped === true);

      console.log('');
      console.log('C. extends= NAMING A FURTHER TEMPLATED ANCESTOR IS ALLOWED:');
      healthy('skip', 'b');

      console.log('');
      console.log('D. A TEMPLATE-LESS HELPER CLASS IN THE CHAIN IS ALLOWED:');
      healthy('via_helper', 'a');
      healthy('helper_between', 'b');
      assert('the helper methods are inherited',
             this.sid('via_helper').helper_method() === 'helper' &&
             this.sid('helper_between').helper_method() === 'helper_b');

      console.log('');
      console.log('E. A CLASS EXTENDING Jqhtml_Component DIRECTLY MAY USE ANY extends=:');
      healthy('direct', 'a');

      console.log('');
      console.log('F. SLOT-ONLY WITH NO extends= STILL INHERITS VIA THE PROTOTYPE CHAIN:');
      healthy('slot_proto', 'b');
      assert('Ejc_Slot_Proto has Ejc_Grid_B\'s methods', this.sid('slot_proto').which_parent() === 'B');

      console.log('');
      console.log('G. A FULL TEMPLATE RENDERS ITS OWN MARKUP, NEITHER PARENT\'S:');
      healthy('full_own', 'own');

      console.log('');
      console.log('H. extends= NAMING A MISSING TEMPLATE FALLS BACK TO THE PROTOTYPE CHAIN:');
      healthy('missing', 'b');

      console.log('');
      console.log('I. A TEMPLATE-ONLY COMPONENT WITH extends= IS NEVER A CONFLICT:');
      healthy('tpl_only', 'a');

      console.log('');
      console.log('J. NO ALLOWED CASE REPORTED AN ERROR:');
      const stray = this.state.errors.filter(e => !e.includes('Ejc_Conflict') && !e.includes('Ejc_Full_Conflict'));
      assert('no other error reached console.error -> ' + stray.length, stray.length === 0);

      console.log('');
      console.log('K. THE CACHED VERDICT IS RESET WHEN A TEMPLATE IS REGISTERED:');
      // Ejc_Late extends="Ejc_Late_Target", which does not exist yet: allowed, falls back to B.
      const stage = this.$sid('late_stage');
      const late1 = $('<div>').appendTo(stage).component('Ejc_Late', {}).component();
      await settled(late1.ready(), 1500);
      assert('before the target exists Ejc_Late renders B -> [' + markers(late1) + ']',
             late1._stopped !== true && markers(late1) === 'b');

      // Registering the target makes extends= real, and it is not a templated ancestor.
      jqhtml.register_template({
        name: 'Ejc_Late_Target',
        tag: 'div',
        render: function(data, args, content, jqhtml) { const _output = new jqhtml.Markup(this); _output.p('<div class="ejc-late-target-marker">LATE</div>'); return _output; }
      });
      const late2 = $('<div>').appendTo(stage).component('Ejc_Late', {}).component();
      await settled(late2.ready(), 1500);
      assert('after the target is registered a new Ejc_Late is stopped', late2._stopped === true);
      assert('the error names Ejc_Late_Target',
             errors_naming('Ejc_Late').some(e => /extends="Ejc_Late_Target"/.test(e)));

      console.log('');
      console.log('L. NOTHING WEDGES THE ROOT:');
      // Reaching on_ready() at all is the check: a wedged root never gets here and the
      // run fails with no SUMMARY. (No elapsed-time limit: the result must not depend on
      // system load.)
      console.log('   (root reached ready ' + elapsed + 'ms after on_create())');
      assert('the root itself is not stopped', this._stopped !== true);
    } catch (error) {
      console.log('   FAIL: the test itself threw -> ' + error.message);
      console.error(error);
      failed++;
    }

    console.error = this.state.real_console_error;

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
