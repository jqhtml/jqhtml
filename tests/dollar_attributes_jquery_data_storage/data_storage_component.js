class Data_Storage_Component extends Jqhtml_Component {
  on_ready() {
    console.log('[Data_Storage_Component] on_ready() called');
    console.log('');
    console.log('========================================');
    console.log('JQUERY .DATA() STORAGE TESTS:');
    console.log('========================================');
    console.log('');

    const test_keys = ['product_id', 'category', 'price', 'in_stock'];

    const tests = [
      {
        name: 'this.args access',
        key: 'product_id',
        via_args: this.args.product_id,
        expected: 'ABC123'
      },
      {
        name: 'jQuery .data() access',
        key: 'product_id',
        via_data: this.$.data('product_id'),
        expected: 'ABC123'
      },
      {
        name: 'this.args.category',
        key: 'category',
        via_args: this.args.category,
        expected: 'electronics'
      },
      {
        name: 'jQuery .data("category")',
        key: 'category',
        via_data: this.$.data('category'),
        expected: 'electronics'
      },
      {
        name: 'this.args.price (number)',
        key: 'price',
        via_args: this.args.price,
        expected: 99.99,
        type_check: 'number'
      },
      {
        name: 'this.args.in_stock (boolean)',
        key: 'in_stock',
        via_args: this.args.in_stock,
        expected: true,
        type_check: 'boolean'
      }
    ];

    console.log('1. ACCESS TESTS:');
    console.log('');

    let all_passed = true;

    tests.forEach(test => {
      const value = test.via_args !== undefined ? test.via_args : test.via_data;
      const passed = value === test.expected;
      const status = passed ? '✅ PASS' : '❌ FAIL';

      console.log(`${test.name}: ${status}`);
      console.log(`   Expected: ${JSON.stringify(test.expected)}`);
      console.log(`   Actual: ${JSON.stringify(value)}`);

      if (test.type_check) {
        const type_match = typeof value === test.type_check;
        console.log(`   Type: ${typeof value} (expected: ${test.type_check}) ${type_match ? '✅' : '❌'}`);
        if (!type_match) all_passed = false;
      }

      console.log('');

      if (!passed) all_passed = false;
    });

    console.log('========================================');
    console.log('2. DOM ATTRIBUTE TESTS (should NOT exist):');
    console.log('========================================');
    console.log('');

    const dom_tests = [
      {name: 'data-product-id', attr: 'data-product-id'},
      {name: 'data-category', attr: 'data-category'},
      {name: 'data-price', attr: 'data-price'},
      {name: 'data-in-stock', attr: 'data-in-stock'},
      {name: 'product-id', attr: 'product-id'},
      {name: 'category', attr: 'category'}
    ];

    dom_tests.forEach(test => {
      const attr_value = this.$.attr(test.attr);
      const not_present = attr_value === undefined;
      const status = not_present ? '✅ PASS' : '❌ FAIL';

      console.log(`${test.attr}: ${status}`);
      console.log(`   Should be: undefined`);
      console.log(`   Actual: ${attr_value}`);
      console.log('');

      if (!not_present) all_passed = false;
    });

    console.log('========================================');
    console.log('3. HTML INSPECTION:');
    console.log('========================================');
    console.log('');

    const outer_html = this.$.prop('outerHTML');
    const contains_data_attrs = outer_html.includes('data-product-id') ||
                                outer_html.includes('data-category') ||
                                outer_html.includes('data-price') ||
                                outer_html.includes('data-in-stock');

    console.log('Checking outerHTML for data-* attributes...');
    console.log(`   Contains data-product-id: ${outer_html.includes('data-product-id')}`);
    console.log(`   Contains data-category: ${outer_html.includes('data-category')}`);
    console.log(`   Contains data-price: ${outer_html.includes('data-price')}`);
    console.log(`   Contains data-in-stock: ${outer_html.includes('data-in-stock')}`);
    console.log('');

    if (contains_data_attrs) {
      console.log('❌ FAIL: $ attributes leaked into DOM!');
      console.log('');
      all_passed = false;
    } else {
      console.log('✅ PASS: No $ attribute data in DOM');
      console.log('');
    }

    console.log('========================================');
    console.log('FINAL RESULT:');
    console.log('========================================');

    if (all_passed) {
      console.log('✅ ALL STORAGE TESTS PASSED');
      console.log('   - Values accessible via this.args');
      console.log('   - Values accessible via jQuery .data()');
      console.log('   - No data-* attributes in DOM');
      console.log('   - $ attributes stored in-memory only');
      this.$sid('results').html('<h3 style="color: green;">✅ All tests passed</h3>');
    } else {
      console.log('❌ SOME STORAGE TESTS FAILED');
      this.$sid('results').html('<h3 style="color: red;">❌ Some tests failed</h3>');
    }

    console.log('');
    console.log('========================================');
    console.log('');
  }
}
