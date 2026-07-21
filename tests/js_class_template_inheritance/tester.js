/**
 * Phone_Text_Input - Extends Text_Input without defining a template
 *
 * This component has NO .jqhtml file - it should inherit the template
 * from Text_Input via the JavaScript prototype chain.
 */
class Phone_Text_Input extends Text_Input {
  async on_ready() {
    console.log('[Phone_Text_Input] on_ready: Phone input initialized (using inherited template)');
  }

  /**
   * Get the phone number formatted as US phone number
   * Format: (XXX) XXX-XXXX
   * @returns {string}
   */
  get_formatted_phone() {
    const value = this.get_value().replace(/\D/g, ''); // Remove non-digits

    if (value.length === 0) {
      return '';
    }

    if (value.length <= 3) {
      return `(${value}`;
    } else if (value.length <= 6) {
      return `(${value.slice(0, 3)}) ${value.slice(3)}`;
    } else {
      return `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`;
    }
  }

  /**
   * Set value and auto-format as phone number
   * @param {string} value
   */
  set_phone(value) {
    this.set_value(value);
    const formatted = this.get_formatted_phone();
    this.set_value(formatted);
  }
}

// Register Phone_Text_Input so framework knows about it
window.jqhtml.register_component('Phone_Text_Input', Phone_Text_Input);
console.log('[Tester.js] Registered Phone_Text_Input component');

class Tester extends Jqhtml_Component {
  async on_ready() {
    console.log('[Tester] on_ready: Running template inheritance tests...');

    const phoneInput = this.sid('phone_input');
    const results = [];

    // Test 1: Component rendered successfully (template inheritance worked)
    if (phoneInput) {
      results.push('✓ Phone_Text_Input rendered successfully (template inherited from Text_Input)');
      console.log('[Tester] ✓ Test 1 passed: Component rendered');
    } else {
      results.push('✗ Phone_Text_Input failed to render');
      console.log('[Tester] ✗ Test 1 failed: Component not found');
    }

    // Test 2: Inherited method works (get_value/set_value from Text_Input)
    phoneInput.set_value('5551234567');
    const rawValue = phoneInput.get_value();
    if (rawValue === '5551234567') {
      results.push('✓ Inherited methods work (set_value/get_value from Text_Input)');
      console.log('[Tester] ✓ Test 2 passed: Inherited methods work');
    } else {
      results.push(`✗ Inherited methods failed (expected "5551234567", got "${rawValue}")`);
      console.log('[Tester] ✗ Test 2 failed: Got', rawValue);
    }

    // Test 3: Child-specific method works (get_formatted_phone from Phone_Text_Input)
    const formatted = phoneInput.get_formatted_phone();
    const expected = '(555) 123-4567';
    if (formatted === expected) {
      results.push(`✓ Child method works: get_formatted_phone() returned "${formatted}"`);
      console.log('[Tester] ✓ Test 3 passed: Phone formatting works');
    } else {
      results.push(`✗ Phone formatting failed (expected "${expected}", got "${formatted}")`);
      console.log('[Tester] ✗ Test 3 failed: Got', formatted);
    }

    // Test 4: set_phone auto-formats
    phoneInput.set_phone('8005551212');
    const autoFormatted = phoneInput.get_value();
    const expectedAutoFormat = '(800) 555-1212';
    if (autoFormatted === expectedAutoFormat) {
      results.push(`✓ Auto-formatting works: set_phone() formatted as "${autoFormatted}"`);
      console.log('[Tester] ✓ Test 4 passed: Auto-formatting works');
    } else {
      results.push(`✗ Auto-formatting failed (expected "${expectedAutoFormat}", got "${autoFormatted}")`);
      console.log('[Tester] ✗ Test 4 failed: Got', autoFormatted);
    }

    // Display results
    const $results = this.$sid('results');
    results.forEach(result => {
      const $line = $('<div>').text(result);
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
