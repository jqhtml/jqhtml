class This_Data_Freeze_Holes extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    // Children are ready before the parent, so every child has already reported.
    const results = window.__freeze_holes_results || [];
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
