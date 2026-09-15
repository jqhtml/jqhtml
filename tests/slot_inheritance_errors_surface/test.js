class Slot_Inheritance_Errors_Surface extends Jqhtml_Component {
  on_create() {
    // Patch console.error HERE, not in on_ready(): both children are declared in this
    // component's template, so they boot (and fail) during this component's _render(),
    // which happens before on_ready(). This is also the vantage point that proves the
    // failure is REPORTED - pre-fix it was a console.warn nobody reads.
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
    console.error = this.state.real_console_error;

    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };

    const all_errors = this.state.errors.join('\n');

    try {
      console.log('');
      console.log('A. A PARENT TEMPLATE THAT THROWS IS REPORTED, NOT SWALLOWED:');

      // Pre-fix: `catch -> console.warn -> instructions = []`. The child rendered as an
      // empty div, console.error never saw anything, and the defect was invisible.
      assert('an error naming the child component (Sie_Child) reached console.error',
             /Sie_Child/.test(all_errors));
      assert('the same report names the parent template (Sie_Bad_Parent)',
             /Sie_Bad_Parent/.test(all_errors));

      const child = this.sid('child');
      assert('the failing child exists -> ' + !!child, !!child);
      assert('the failing child reports _stopped -> ' + (child && child._stopped),
             !!child && child._stopped === true);
      assert('the failing child is marked _Component_Stopped',
             !!child && child.$.hasClass('_Component_Stopped'));

      console.log('');
      console.log('B. A SLOT-ONLY TEMPLATE WITH NO PARENT AT ALL IS AN ERROR:');

      // Pre-fix: `console.warn('No parent template found ... rendering empty')`.
      assert('an error naming Sie_Orphan reached console.error',
             /Sie_Orphan/.test(all_errors));
      assert('the report says the slot-only template has no parent template',
             /Sie_Orphan[\s\S]*no parent template/.test(all_errors));

      const orphan = this.sid('orphan');
      assert('the orphan reports _stopped -> ' + (orphan && orphan._stopped),
             !!orphan && orphan._stopped === true);

      console.log('');
      console.log('C. NEITHER FAILURE WEDGES THE ROOT:');

      // The root is only running on_ready() at all because both failed children were
      // stopped and released it. The timing assertion pins the "within 1s" requirement;
      // a regression that re-wedges the parent produces no SUMMARY at all.
      assert('the root reached ready within 1s of on_create() -> ' + elapsed + 'ms', elapsed < 1000);
      assert('the root itself is not stopped', this._stopped !== true);
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
