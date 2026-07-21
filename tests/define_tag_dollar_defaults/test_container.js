class Test_Container extends Jqhtml_Component {
  on_ready() {
    console.log('');
    console.log('========================================');
    console.log('DEFINE TAG $ DEFAULTS TESTS:');
    console.log('========================================');
    console.log('');

    const tests = [
      {
        name: 'Test 1: Default Values',
        component_id: 'default_instance',
        expected: {
          per_page: {value: 25, type: 'number'},
          sortable: {value: true, type: 'boolean'},
          endpoint: {value: 'https://api.example.com/data', type: 'string'},
          theme: {value: 'light', type: 'string'}
        }
      },
      {
        name: 'Test 2: Full Override',
        component_id: 'override_instance',
        expected: {
          per_page: {value: 50, type: 'number'},
          sortable: {value: false, type: 'boolean'},
          endpoint: {value: 'https://override.com/api', type: 'string'},
          theme: {value: 'dark', type: 'string'}
        }
      },
      {
        name: 'Test 3: Partial Override (per_page=100, theme=blue, others default)',
        component_id: 'partial_instance',
        expected: {
          per_page: {value: 100, type: 'number'},
          sortable: {value: true, type: 'boolean'},
          endpoint: {value: 'https://api.example.com/data', type: 'string'},
          theme: {value: 'blue', type: 'string'}
        }
      }
    ];

    let all_passed = true;

    tests.forEach((test, test_idx) => {
      console.log(`${test.name}:`);
      console.log('');

      const component = this.sid(test.component_id);

      if (!component) {
        console.log(`❌ FAIL: Component "${test.component_id}" not found`);
        console.log('');
        all_passed = false;
        return;
      }

      Object.keys(test.expected).forEach(key => {
        const actual_value = component.args[key];
        const actual_type = typeof actual_value;
        const expected_value = test.expected[key].value;
        const expected_type = test.expected[key].type;

        const value_match = actual_value === expected_value;
        const type_match = actual_type === expected_type;
        const passed = value_match && type_match;
        const status = passed ? '✅ PASS' : '❌ FAIL';

        console.log(`  ${key}: ${status}`);
        console.log(`    Expected: ${JSON.stringify(expected_value)} (${expected_type})`);
        console.log(`    Actual: ${JSON.stringify(actual_value)} (${actual_type})`);

        if (!passed) all_passed = false;
      });

      console.log('');
    });

    console.log('========================================');
    console.log('FINAL RESULT:');
    console.log('========================================');

    if (all_passed) {
      console.log('✅ ALL DEFAULTS TESTS PASSED');
      console.log('   - Default values applied correctly');
      console.log('   - Full overrides work correctly');
      console.log('   - Partial overrides work correctly');
      console.log('   - Types preserved (quoted vs unquoted)');
      this.$sid('results').html('<h3 style="color: green;">✅ All tests passed</h3>');
    } else {
      console.log('❌ SOME DEFAULTS TESTS FAILED');
      this.$sid('results').html('<h3 style="color: red;">❌ Some tests failed</h3>');
    }

    console.log('');
    console.log('========================================');
    console.log('');
  }
}
