class This_Data_Deep_Freeze extends Jqhtml_Component {
  on_create() {
    // An OBJECT arg, so on_load() can check that the read-only args proxy hands out
    // the same wrapper twice (the memoization LOW).
    this.state.filter = { mode: 'all', tags: ['a'] };
  }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    // Children are ready before the parent, so both have already reported.
    const results = window.__deep_freeze_results || [];
    let passed = 0, failed = 0;

    console.log('');
    for (const r of results) {
      console.log('   ' + (r.ok ? 'PASS' : 'FAIL') + ': ' + r.name);
      r.ok ? passed++ : failed++;
    }

    if (results.length === 0) {
      console.log('   FAIL: no assertions ran at all');
      failed++;
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    this.$sid('results').text(failed === 0 ? 'All tests passed' : failed + ' failed');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
