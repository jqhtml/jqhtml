class Child_Component extends Jqhtml_Component {
  on_ready() {
    console.log('[Child_Component] on_ready() called');
    console.log('');
    console.log('========================================');
    console.log('DOLLAR ATTRIBUTE TYPE TESTS:');
    console.log('========================================');
    console.log('');

    const tests = [
      {
        name: 'string_quoted ("123")',
        arg: 'string_quoted',
        expected_type: 'string',
        expected_value: '123',
        actual_value: this.args.string_quoted,
        actual_type: typeof this.args.string_quoted
      },
      {
        name: 'number_unquoted (456)',
        arg: 'number_unquoted',
        expected_type: 'number',
        expected_value: 456,
        actual_value: this.args.number_unquoted,
        actual_type: typeof this.args.number_unquoted
      },
      {
        name: 'bool_true (true)',
        arg: 'bool_true',
        expected_type: 'boolean',
        expected_value: true,
        actual_value: this.args.bool_true,
        actual_type: typeof this.args.bool_true
      },
      {
        name: 'bool_false (false)',
        arg: 'bool_false',
        expected_type: 'boolean',
        expected_value: false,
        actual_value: this.args.bool_false,
        actual_type: typeof this.args.bool_false
      },
      {
        name: 'bool_string_true ("true")',
        arg: 'bool_string_true',
        expected_type: 'string',
        expected_value: 'true',
        actual_value: this.args.bool_string_true,
        actual_type: typeof this.args.bool_string_true
      },
      {
        name: 'bool_string_false ("false")',
        arg: 'bool_string_false',
        expected_type: 'string',
        expected_value: 'false',
        actual_value: this.args.bool_string_false,
        actual_type: typeof this.args.bool_string_false
      },
      {
        name: 'object_ref (object)',
        arg: 'object_ref',
        expected_type: 'object',
        expected_value: 'object with name="Test Object"',
        actual_value: this.args.object_ref,
        actual_type: typeof this.args.object_ref,
        check_fn: (val) => val && val.name === 'Test Object' && val.value === 42
      },
      {
        name: 'array_ref (array)',
        arg: 'array_ref',
        expected_type: 'object',
        expected_value: '[1,2,3,4,5]',
        actual_value: this.args.array_ref,
        actual_type: typeof this.args.array_ref,
        check_fn: (val) => Array.isArray(val) && val.length === 5 && val[0] === 1
      },
      {
        name: 'callback (function)',
        arg: 'callback',
        expected_type: 'function',
        expected_value: 'callable function',
        actual_value: this.args.callback,
        actual_type: typeof this.args.callback,
        check_fn: (val) => typeof val === 'function' && val('test') === 'callback_result'
      },
      {
        name: 'null_value (null)',
        arg: 'null_value',
        expected_type: 'object',
        expected_value: null,
        actual_value: this.args.null_value,
        actual_type: typeof this.args.null_value,
        check_fn: (val) => val === null
      },
      {
        name: 'undefined_value (undefined)',
        arg: 'undefined_value',
        expected_type: 'undefined',
        expected_value: undefined,
        actual_value: this.args.undefined_value,
        actual_type: typeof this.args.undefined_value
      }
    ];

    let all_passed = true;
    let output_lines = [];

    tests.forEach(test => {
      let type_match = test.actual_type === test.expected_type;
      let value_match;

      if (test.check_fn) {
        value_match = test.check_fn(test.actual_value);
      } else {
        value_match = test.actual_value === test.expected_value;
      }

      const passed = type_match && value_match;
      const status = passed ? '✅ PASS' : '❌ FAIL';

      console.log(`${test.name}: ${status}`);
      console.log(`   Expected type: ${test.expected_type}`);
      console.log(`   Actual type: ${test.actual_type}`);
      console.log(`   Expected value: ${JSON.stringify(test.expected_value)}`);
      console.log(`   Actual value: ${JSON.stringify(test.actual_value)}`);

      if (!type_match) {
        console.log(`   ⚠️  TYPE MISMATCH`);
      }
      if (!value_match) {
        console.log(`   ⚠️  VALUE MISMATCH`);
      }

      console.log('');

      output_lines.push(`${test.name}: ${status}`);
      output_lines.push(`  Type: ${test.actual_type} (expected: ${test.expected_type})`);
      output_lines.push(`  Value: ${JSON.stringify(test.actual_value)}`);
      output_lines.push('');

      if (!passed) all_passed = false;
    });

    console.log('========================================');
    console.log('FINAL RESULT:');
    console.log('========================================');

    if (all_passed) {
      console.log('✅ ALL TYPE TESTS PASSED');
      console.log('   - Quoted attributes are strings');
      console.log('   - Unquoted numbers are numbers');
      console.log('   - Unquoted booleans are booleans');
      console.log('   - Objects passed by reference');
      console.log('   - Functions are callable');
      output_lines.unshift('✅ ALL TESTS PASSED\n');
    } else {
      console.log('❌ SOME TYPE TESTS FAILED');
      output_lines.unshift('❌ SOME TESTS FAILED\n');
    }

    console.log('');
    console.log('========================================');
    console.log('');

    this.$sid('output').text(output_lines.join('\n'));
  }
}
