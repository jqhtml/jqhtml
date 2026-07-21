class Event_Binding_Component extends Jqhtml_Component {
  on_create() {
    this.click_count = 0;
    this.change_value = null;
    this.multi_events = [];
    this.focus_state = 'none';
    this.key_count = 0;
    this.submit_count = 0;
  }

  on_ready() {
    console.log('[Event_Binding_Component] on_ready() called');
    console.log('Event handlers should be bound via @ attributes');
    console.log('');
    console.log('========================================');
    console.log('AUTO-TRIGGERING EVENTS FOR TESTING:');
    console.log('========================================');
    console.log('');

    // Auto-trigger click event
    this.$sid('click_btn').click();

    // Auto-trigger change event
    this.$sid('text_input').val('test value').change();

    // Auto-trigger multiple events
    this.$sid('multi_target').click();
    this.$sid('multi_target').trigger('mouseover');

    // Auto-trigger focus/blur
    this.$sid('focus_input').focus();
    this.$sid('focus_input').blur();

    // Auto-trigger keyup
    const keyEvent = $.Event('keyup', {key: 'a', keyCode: 65});
    this.$sid('keyboard_input').trigger(keyEvent);

    // Auto-trigger submit
    this.$sid('test_form').submit();

    console.log('');
    console.log('========================================');
    console.log('TEST VALIDATION:');
    console.log('========================================');
    console.log('');

    // Validate results
    const tests = [
      {
        name: 'Click event',
        passed: this.click_count === 1,
        expected: 1,
        actual: this.click_count
      },
      {
        name: 'Change event',
        passed: this.change_value === 'test value',
        expected: 'test value',
        actual: this.change_value
      },
      {
        name: 'Multiple events (click + mouseover)',
        passed: this.multi_events.includes('click') && this.multi_events.includes('mouseover'),
        expected: 'click, mouseover',
        actual: this.multi_events.join(', ')
      },
      {
        name: 'Focus/Blur events',
        passed: this.focus_state === 'blurred',
        expected: 'blurred',
        actual: this.focus_state
      },
      {
        name: 'Keyup event',
        passed: this.key_count === 1,
        expected: 1,
        actual: this.key_count
      },
      {
        name: 'Submit event (with preventDefault)',
        passed: this.submit_count === 1,
        expected: 1,
        actual: this.submit_count
      }
    ];

    let all_passed = true;

    tests.forEach(test => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${test.name}: ${status}`);
      console.log(`   Expected: ${test.expected}`);
      console.log(`   Actual: ${test.actual}`);
      console.log('');

      if (!test.passed) all_passed = false;
    });

    console.log('========================================');
    console.log('FINAL RESULT:');
    console.log('========================================');

    if (all_passed) {
      console.log('✅ ALL EVENT BINDING TESTS PASSED');
      console.log('   - All @ attributes bound correctly');
      console.log('   - Event objects received properly');
      console.log('   - Component context (this) correct');
      this.$sid('test_results').html('<h3 style="color: green;">✅ All tests passed</h3>');
    } else {
      console.log('❌ SOME EVENT BINDING TESTS FAILED');
      this.$sid('test_results').html('<h3 style="color: red;">❌ Some tests failed</h3>');
    }

    console.log('');
    console.log('========================================');
    console.log('');
  }

  // Click event handler
  handle_click(event) {
    this.click_count++;
    this.$sid('click_count').text(`Clicks: ${this.click_count}`);

    console.log('✅ Click event fired');
    console.log(`   Event type: ${event.type}`);
    console.log(`   Event target: ${event.target.tagName}`);
    console.log(`   'this' context is component: ${this instanceof Event_Binding_Component}`);
    console.log(`   Click count: ${this.click_count}`);
  }

  // Change event handler
  handle_change(event) {
    this.change_value = event.target.value;
    this.$sid('change_result').text(`Change value: ${this.change_value}`);

    console.log('✅ Change event fired');
    console.log(`   Value: ${this.change_value}`);
    console.log(`   Event type: ${event.type}`);
  }

  // Multiple events - click
  handle_multi_click(event) {
    this.multi_events.push('click');
    this.$sid('multi_result').text(`Events: ${this.multi_events.join(', ')}`);

    console.log('✅ Multi-event click fired');
    console.log(`   Events so far: ${this.multi_events.join(', ')}`);
  }

  // Multiple events - mouseover
  handle_mouseover(event) {
    this.multi_events.push('mouseover');
    this.$sid('multi_result').text(`Events: ${this.multi_events.join(', ')}`);

    console.log('✅ Multi-event mouseover fired');
    console.log(`   Events so far: ${this.multi_events.join(', ')}`);
  }

  // Focus event
  handle_focus(event) {
    this.focus_state = 'focused';
    this.$sid('focus_result').text(`Focus state: ${this.focus_state}`);

    console.log('✅ Focus event fired');
    console.log(`   State: ${this.focus_state}`);
  }

  // Blur event
  handle_blur(event) {
    this.focus_state = 'blurred';
    this.$sid('focus_result').text(`Focus state: ${this.focus_state}`);

    console.log('✅ Blur event fired');
    console.log(`   State: ${this.focus_state}`);
  }

  // Keyup event
  handle_keyup(event) {
    this.key_count++;
    this.$sid('keyboard_result').text(`Keys pressed: ${this.key_count} (last: ${event.key})`);

    console.log('✅ Keyup event fired');
    console.log(`   Key: ${event.key}`);
    console.log(`   Key code: ${event.keyCode}`);
    console.log(`   Total keys: ${this.key_count}`);
  }

  // Submit event
  handle_submit(event) {
    event.preventDefault(); // Prevent page reload
    this.submit_count++;
    this.$sid('submit_result').text(`Submit count: ${this.submit_count}`);

    console.log('✅ Submit event fired');
    console.log(`   preventDefault() called: form did not reload page`);
    console.log(`   Submit count: ${this.submit_count}`);
  }
}
