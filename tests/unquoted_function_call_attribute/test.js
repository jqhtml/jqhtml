// Global class to test Class.method('arg') pattern
class My_Model {
  static field_length(field_name) {
    // Simulates a model method that returns field configuration
    const lengths = {
      'first_name': 50,
      'last_name': 100,
      'email': 255
    };
    return lengths[field_name] || 0;
  }
}

// Make it globally accessible
window.My_Model = My_Model;

class Unquoted_Function_Call_Attribute_Test extends Jqhtml_Component {
  test_method(value) {
    return value;
  }

  on_ready() {
    let all_passed = true;
    const results = [];

    // Test 1: this.method('arg') pattern
    const child1 = this.sid('child1');
    const expected1 = 'foobar';
    const actual1 = child1.args.my_attribute;
    const test1_passed = actual1 === expected1;
    results.push({
      name: 'Test 1: this.method(\'arg\')',
      pattern: '$my_attribute=this.test_method(\'foobar\')',
      expected: expected1,
      actual: actual1,
      passed: test1_passed
    });
    if (!test1_passed) all_passed = false;

    // Test 2: Class.method('arg') pattern
    const child2 = this.sid('child2');
    const expected2 = 100;  // My_Model.field_length('last_name') returns 100
    const actual2 = child2.args.my_attribute;
    const test2_passed = actual2 === expected2;
    results.push({
      name: 'Test 2: Class.method(\'arg\')',
      pattern: '$my_attribute=My_Model.field_length(\'last_name\')',
      expected: expected2,
      actual: actual2,
      passed: test2_passed
    });
    if (!test2_passed) all_passed = false;

    // Test 3: Negative integer
    const child3 = this.sid('child3');
    const expected3 = -1;
    const actual3 = child3.args.my_attribute;
    const test3_passed = actual3 === expected3;
    results.push({
      name: 'Test 3: Negative integer',
      pattern: '$my_attribute=-1',
      expected: expected3,
      actual: actual3,
      passed: test3_passed
    });
    if (!test3_passed) all_passed = false;

    // Test 4: Negative float
    const child4 = this.sid('child4');
    const expected4 = -45.67;
    const actual4 = child4.args.my_attribute;
    const test4_passed = actual4 === expected4;
    results.push({
      name: 'Test 4: Negative float',
      pattern: '$my_attribute=-45.67',
      expected: expected4,
      actual: actual4,
      passed: test4_passed
    });
    if (!test4_passed) all_passed = false;

    // Output results
    console.log('========================================');
    console.log('UNQUOTED FUNCTION CALL ATTRIBUTE TESTS:');
    console.log('========================================');
    console.log('');

    results.forEach(test => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${test.name}: ${status}`);
      console.log(`   Pattern: ${test.pattern}`);
      console.log(`   Expected: ${test.expected}`);
      console.log(`   Actual: ${test.actual}`);
      console.log('');
    });

    console.log('========================================');
    console.log('FINAL RESULT:');
    console.log('========================================');

    if (all_passed) {
      console.log('✅ ALL TESTS PASSED');
      this.$sid('results').html('<h3 style="color: green;">✅ All tests passed</h3>');
      window.testPassed = true;
    } else {
      console.log('❌ SOME TESTS FAILED');
      this.$sid('results').html('<h3 style="color: red;">❌ Some tests failed - see console</h3>');
      window.testPassed = false;
    }

    console.log('');
    console.log('========================================');
  }
}

class Test_Child extends Jqhtml_Component {
  // No special behavior needed
}
