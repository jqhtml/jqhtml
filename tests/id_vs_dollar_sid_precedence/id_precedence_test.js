class Id_Precedence_Test extends Jqhtml_Component {
  on_ready() {
    console.log('');
    console.log('========================================');
    console.log('ID VS $SID PRECEDENCE TEST:');
    console.log('========================================');
    console.log('');

    const tests = [];

    // TEST 1: When both id and $sid present, $sid takes precedence
    console.log('TEST 1: Both id and $sid present (should use $sid)');

    // Try to access via $sid (should work)
    const via_scoped = this.$sid('scoped_bar');
    console.log(`  this.$sid('scoped_bar'): found=${via_scoped.length > 0}`);

    // Check actual ID in DOM
    const both_elem = this.$.find('.both-present');
    const actual_id = both_elem.attr('id');
    const has_data_sid = both_elem.attr('data-sid') !== undefined;

    console.log(`  Actual DOM id attribute: "${actual_id}"`);
    console.log(`  Has data-sid attribute: ${has_data_sid}`);
    console.log(`  data-sid value: "${both_elem.attr('data-sid')}"`);

    // Should have scoped ID format: scoped_bar:_cid
    const has_scoped_format = actual_id && actual_id.startsWith('scoped_bar:');

    if (via_scoped.length > 0 && has_scoped_format && has_data_sid) {
      console.log('✅ PASS: $sid takes precedence (scoped ID used)');
      tests.push(true);
    } else {
      console.log('❌ FAIL: $sid did not take precedence');
      tests.push(false);
    }
    console.log('');

    // TEST 2: Only $sid present works normally
    console.log('TEST 2: Only $sid present (should work normally)');

    const only_scoped = this.$sid('only_scoped');
    const only_scoped_elem = this.$.find('.only-scoped');
    const only_scoped_id = only_scoped_elem.attr('id');

    console.log(`  this.$sid('only_scoped'): found=${only_scoped.length > 0}`);
    console.log(`  Actual DOM id: "${only_scoped_id}"`);

    const has_scoped_format_2 = only_scoped_id && only_scoped_id.startsWith('only_scoped:');

    if (only_scoped.length > 0 && has_scoped_format_2) {
      console.log('✅ PASS: $sid works normally when alone');
      tests.push(true);
    } else {
      console.log('❌ FAIL: $sid did not work correctly');
      tests.push(false);
    }
    console.log('');

    // TEST 3: Only regular id passes through unchanged
    console.log('TEST 3: Only regular id (should pass through)');

    const only_regular_elem = this.$.find('.only-regular');
    const only_regular_id = only_regular_elem.attr('id');
    const has_data_sid_3 = only_regular_elem.attr('data-sid') !== undefined;

    console.log(`  Actual DOM id: "${only_regular_id}"`);
    console.log(`  Has data-sid: ${has_data_sid_3}`);
    console.log(`  Expected: id="only_regular", no data-sid`);

    // Regular id should NOT be scoped and should NOT have data-sid
    if (only_regular_id === 'only_regular' && !has_data_sid_3) {
      console.log('✅ PASS: Regular id passes through unchanged');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Regular id was modified');
      tests.push(false);
    }
    console.log('');

    // TEST 4: Verify scoped_bar NOT accessible via regular_foo
    console.log('TEST 4: Original id="regular_foo" should not work');

    const via_foo = this.$sid('regular_foo');
    console.log(`  this.$sid('regular_foo'): found=${via_foo.length > 0}`);

    if (via_foo.length === 0) {
      console.log('✅ PASS: Original id name is ignored (as expected)');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Original id name still works (should not)');
      tests.push(false);
    }
    console.log('');

    // Final result
    console.log('========================================');
    const all_passed = tests.every(t => t);
    if (all_passed) {
      console.log('✅ ALL TESTS PASSED');
      this.$sid('results').html('<span style="color: green;">✅ All tests passed</span>');
    } else {
      console.log('❌ SOME TESTS FAILED');
      this.$sid('results').html('<span style="color: red;">❌ Some tests failed</span>');
    }
    console.log('========================================');
    console.log('');
  }
}
