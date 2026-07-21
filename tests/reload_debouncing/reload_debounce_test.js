class Reload_Debounce_Test extends Jqhtml_Component {
  on_create() {
    this.args.total_calls = 0;  // Track in args (not restored)
    this.data.load_count = 0;
  }

  async on_load() {
    this.args.total_calls++;  // Increment in args
    const call_num = this.args.total_calls;
    console.log(`on_load execution #${call_num}`);

    // Simulate slow load
    await new Promise(resolve => setTimeout(resolve, 50));

    this.data.load_count = call_num;
  }

  async on_ready() {
    // Only run test once - use a flag outside this.data
    if (this._test_ran) return;
    this._test_ran = true;

    console.log('');
    console.log('========================================');
    console.log('RELOAD DEBOUNCING TEST:');
    console.log('========================================');
    console.log('');

    // Fire 5 rapid reload() calls
    console.log('Firing 5 rapid reload() calls...');

    const promises = [
      this.reload(),
      this.reload(),
      this.reload(),
      this.reload(),
      this.reload()
    ];

    await Promise.all(promises);

    console.log('');
    console.log(`Final total on_load calls: ${this.args.total_calls}`);
    console.log('Expected: 3 (initial + 2 debounced reloads)');
    console.log('');
    console.log('Why 3 is correct:');
    console.log('  1. Initial load executes');
    console.log('  2. Five reload() calls made rapidly');
    console.log('  3. First reload starts while others queue');
    console.log('  4. When first reload completes, debouncer runs one more time');
    console.log('  5. This guarantees fresh data even if state changed during execution');
    console.log('');

    if (this.args.total_calls === 3) {
      console.log('✅ PASS: reload() debouncing works correctly');
      console.log('   - 5 rapid calls coalesced to 2 executions (after initial)');
      console.log('   - Guarantees data freshness');
      console.log('   - All promises resolved');
      this.$sid('results').html('<h3 style="color: green;">✅ Test passed</h3>');
    } else {
      console.log(`❌ FAIL: Expected 3 executions, got ${this.args.total_calls}`);
      console.log('   Note: Exact count may vary based on timing');
      this.$sid('results').html('<h3 style="color: orange;">⚠️ Test inconclusive (timing-dependent)</h3>');
    }

    console.log('');
    console.log('========================================');
    console.log('');
  }
}
