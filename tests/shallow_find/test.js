class Test_ShallowFind extends Jqhtml_Component {
  on_ready() {
    console.log('=== shallowFind() Test Suite ===\n');

    // Test 1: Basic nested widgets
    const test1 = this.$.find('[data-test="1"]');
    const result1 = test1.shallowFind('.Widget');
    console.log('Test 1: Basic Nested Widgets');
    console.log('Expected: 2 matches (Widget 1, Widget 2)');
    console.log('Found:', result1.length, 'matches');
    result1.each(function() {
      console.log('  -', $(this).attr('data-sid'), ':', $(this).text().trim().split('\n')[0]);
    });
    console.log('Result:', result1.length === 2 ? '✓ PASS' : '✗ FAIL');
    console.log('');

    // Test 2: Deep nesting
    const test2 = this.$.find('[data-test="2"]');
    const result2 = test2.shallowFind('.Widget');
    console.log('Test 2: Deep Nesting');
    console.log('Expected: 1 match (Widget 3)');
    console.log('Found:', result2.length, 'matches');
    result2.each(function() {
      console.log('  -', $(this).attr('data-sid'), ':', $(this).text().trim().split('\n')[0]);
    });
    console.log('Result:', result2.length === 1 ? '✓ PASS' : '✗ FAIL');
    console.log('');

    // Test 3: No matches
    const test3 = this.$.find('[data-test="3"]');
    const result3 = test3.shallowFind('.Widget');
    console.log('Test 3: No Matches');
    console.log('Expected: 0 matches');
    console.log('Found:', result3.length, 'matches');
    console.log('Result:', result3.length === 0 ? '✓ PASS' : '✗ FAIL');
    console.log('');

    // Test 4: Adjacent siblings
    const test4 = this.$.find('[data-test="4"]');
    const result4 = test4.shallowFind('.Widget');
    console.log('Test 4: Adjacent Siblings');
    console.log('Expected: 3 matches (Widget 4, 5, 6)');
    console.log('Found:', result4.length, 'matches');
    result4.each(function() {
      console.log('  -', $(this).attr('data-sid'), ':', $(this).text().trim());
    });
    console.log('Result:', result4.length === 3 ? '✓ PASS' : '✗ FAIL');
    console.log('');

    // Test 5: Mixed hierarchy
    const test5 = this.$.find('[data-test="5"]');
    const result5 = test5.shallowFind('.Widget');
    console.log('Test 5: Mixed Hierarchy');
    console.log('Expected: 2 matches (Widget 7, Widget 8)');
    console.log('Found:', result5.length, 'matches');
    result5.each(function() {
      console.log('  -', $(this).attr('data-sid'), ':', $(this).text().trim().split('\n')[0]);
    });
    console.log('Result:', result5.length === 2 ? '✓ PASS' : '✗ FAIL');
    console.log('');

    // Performance comparison
    console.log('=== Performance Comparison ===\n');

    const perfTest = this.$.find('[data-test="5"]');

    // Test find() performance
    const t1 = performance.now();
    for (let i = 0; i < 1000; i++) {
      perfTest.find('.Widget');
    }
    const t2 = performance.now();
    const findTime = (t2 - t1).toFixed(3);

    // Test shallowFind() performance
    const t3 = performance.now();
    for (let i = 0; i < 1000; i++) {
      perfTest.shallowFind('.Widget');
    }
    const t4 = performance.now();
    const shallowFindTime = (t4 - t3).toFixed(3);

    console.log('1000 iterations of .find(".Widget"):', findTime, 'ms');
    console.log('1000 iterations of .shallowFind(".Widget"):', shallowFindTime, 'ms');
    console.log('Difference:', (parseFloat(shallowFindTime) - parseFloat(findTime)).toFixed(3), 'ms');
    console.log('');
    console.log('Note: shallowFind() is slightly slower due to traversal logic,');
    console.log('but provides different semantics (stops at matches)');
  }
}
