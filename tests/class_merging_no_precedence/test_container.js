class Test_Container extends Jqhtml_Component {
  on_ready() {
    console.log('');
    console.log('========================================');
    console.log('CLASS MERGING TEST:');
    console.log('========================================');
    console.log('');

    // Get card component
    const card = this.sid('card');
    const class_attr = card.$.attr('class');
    const classes = class_attr.split(' ').filter(c => c.length > 0);

    console.log('Rendered classes:', classes);
    console.log('');

    // Expected classes:
    // 1. 'card-base' (from Define)
    // 2. 'highlight' (from invocation)
    // 3. 'shadow' (from invocation)
    // 4. 'Base_Card' (component name, auto-added)
    // 5. 'Jqhtml_Component' (framework marker, auto-added)

    const expected = ['card-base', 'highlight', 'shadow', 'Base_Card', 'Jqhtml_Component'];
    const tests = [];

    console.log('Expected classes:');
    expected.forEach(cls => {
      const present = classes.includes(cls);
      console.log(`  ${cls}: ${present ? '✅ present' : '❌ MISSING'}`);
      tests.push(present);
    });
    console.log('');

    // Check for duplicates
    const unique_classes = [...new Set(classes)];
    const has_duplicates = unique_classes.length !== classes.length;

    if (!has_duplicates) {
      console.log('✅ No duplicate classes');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Duplicate classes found');
      const duplicates = classes.filter((c, i) => classes.indexOf(c) !== i);
      console.log('  Duplicates:', duplicates);
      tests.push(false);
    }
    console.log('');

    // Check count
    if (classes.length === 5) {
      console.log('✅ Correct class count (5)');
      tests.push(true);
    } else {
      console.log(`❌ FAIL: Expected 5 classes, got ${classes.length}`);
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
