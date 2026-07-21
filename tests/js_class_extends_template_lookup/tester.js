class Tester extends Jqhtml_Component {
  async on_ready() {
    console.log('[Tester] on_ready: Running JS class template lookup tests...');

    const form = this.sid('form_instance');
    const results = [];

    // Test 1: Component rendered successfully
    if (form) {
      results.push('✓ My_Form rendered successfully');
      console.log('[Tester] ✓ Test 1 passed: Component rendered');
    } else {
      results.push('✗ My_Form failed to render');
      console.log('[Tester] ✗ Test 1 failed: Component not found');
    }

    // Test 2: Component is My_Form class
    if (form && form.constructor.name === 'My_Form') {
      results.push('✓ Component is My_Form class');
      console.log('[Tester] ✓ Test 2 passed: Correct class');
    } else {
      results.push(`✗ Wrong class (expected My_Form, got ${form ? form.constructor.name : 'null'})`);
      console.log('[Tester] ✗ Test 2 failed');
    }

    // Test 3: Base class method works (get_data)
    if (form && typeof form.get_data === 'function') {
      const data = form.get_data();
      results.push(`✓ Base class method works: get_data() returned object`);
      console.log('[Tester] ✓ Test 3 passed: get_data() works');
    } else {
      results.push('✗ Base class method not available');
      console.log('[Tester] ✗ Test 3 failed');
    }

    // Test 4: Base class method works (validate)
    if (form && typeof form.validate === 'function') {
      const valid = form.validate();
      results.push(`✓ Base class method works: validate() = ${valid}`);
      console.log('[Tester] ✓ Test 4 passed: validate() works');
    } else {
      results.push('✗ validate() method not available');
      console.log('[Tester] ✗ Test 4 failed');
    }

    // Test 5: Template content rendered (from Form_Base template)
    const hasCard = form.$.find('.card-body').length > 0;
    if (hasCard) {
      results.push('✓ Form_Base template used (card-body found)');
      console.log('[Tester] ✓ Test 5 passed: Template found');
    } else {
      results.push('✗ Form_Base template not used');
      console.log('[Tester] ✗ Test 5 failed');
    }

    // Test 6: Template content correct
    const hasHeading = form.$.find('h4').text().includes('Form Base');
    if (hasHeading) {
      results.push('✓ Correct template content rendered');
      console.log('[Tester] ✓ Test 6 passed: Content correct');
    } else {
      results.push('✗ Template content incorrect');
      console.log('[Tester] ✗ Test 6 failed');
    }

    // Display results
    const $results = this.$sid('results');
    results.forEach(result => {
      const $line = $('<div>').text(result).css('margin-bottom', '5px');
      if (result.startsWith('✓')) {
        $line.css('color', 'green');
      } else {
        $line.css('color', 'red');
      }
      $results.append($line);
    });

    console.log('[Tester] All tests complete');
  }
}
