class Test_Container extends Jqhtml_Component {
  on_ready() {
    console.log('');
    console.log('========================================');
    console.log('JQUERY .val() OVERRIDE TEST:');
    console.log('========================================');
    console.log('');

    const tests = [];
    const input = this.sid('custom');

    // TEST 1: Setter with chaining
    console.log('TEST 1: Setter (.val with value)');
    console.log('  Calling: input.$.val("Hello123!!").addClass("test-class")');

    const result = input.$
      .val('Hello123!!')  // Should clean to "hello123"
      .addClass('test-class');  // Chaining should work

    console.log(`  Returned type: ${typeof result}`);
    console.log(`  Is jQuery object: ${result instanceof $}`);
    console.log(`  Has test-class: ${input.$.hasClass('test-class')}`);

    const setter_returns_jquery = result instanceof $ && input.$.hasClass('test-class');

    if (setter_returns_jquery) {
      console.log('✅ PASS: Setter returned jQuery object, chaining works');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Setter did not return jQuery object or chaining failed');
      tests.push(false);
    }
    console.log('');

    // TEST 2: Getter returns uppercase
    console.log('TEST 2: Getter (.val with no args)');
    const value = input.$.val();
    console.log(`  Returned value: "${value}"`);
    console.log(`  Expected: "HELLO123" (uppercase, special chars removed)`);

    if (value === 'HELLO123') {
      console.log('✅ PASS: Getter returned uppercase value');
      tests.push(true);
    } else {
      console.log(`❌ FAIL: Expected "HELLO123", got "${value}"`);
      tests.push(false);
    }
    console.log('');

    // TEST 3: Formatted display shows uppercase
    console.log('TEST 3: Formatted display');
    const formatted_text = input.$sid('formatted').text();
    console.log(`  Formatted text: "${formatted_text}"`);
    console.log(`  Expected: "HELLO123"`);

    if (formatted_text === 'HELLO123') {
      console.log('✅ PASS: Formatted display shows uppercase');
      tests.push(true);
    } else {
      console.log(`❌ FAIL: Expected "HELLO123", got "${formatted_text}"`);
      tests.push(false);
    }
    console.log('');

    // TEST 4: Internal input stores lowercase
    console.log('TEST 4: Internal storage');
    const raw_value = input.$sid('input').val();
    console.log(`  Internal input value: "${raw_value}"`);
    console.log(`  Expected: "hello123" (lowercase, cleaned)`);

    if (raw_value === 'hello123') {
      console.log('✅ PASS: Internal input stores lowercase cleaned value');
      tests.push(true);
    } else {
      console.log(`❌ FAIL: Expected "hello123", got "${raw_value}"`);
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
