class Test_Container extends Jqhtml_Component {
  on_ready() {
    console.log('');
    console.log('========================================');
    console.log('JQUERY PLUGIN GETTER/SETTER TEST:');
    console.log('========================================');
    console.log('');

    const tests = [];

    // TEST 1: Setter mode - returns jQuery object
    console.log('TEST 1: Setter mode (.component with args)');
    const $elem = $('<div>')
      .component('User_Card', {user_id: 123})
      .appendTo(this.$sid('container'))
      .addClass('test-class');  // Chaining should work

    console.log(`  Setter returned type: ${typeof $elem}`);
    console.log(`  Is jQuery object: ${$elem instanceof $}`);
    console.log(`  Has jQuery methods: ${typeof $elem.addClass === 'function'}`);
    console.log(`  test-class added: ${$elem.hasClass('test-class')}`);

    const is_jquery = $elem instanceof $ && typeof $elem.addClass === 'function';
    const has_test_class = $elem.hasClass('test-class');

    if (is_jquery && has_test_class) {
      console.log('✅ PASS: Setter returned jQuery object, chaining works');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Setter did not return proper jQuery object');
      tests.push(false);
    }
    console.log('');

    // TEST 2: Getter mode - returns component instance
    console.log('TEST 2: Getter mode (.component with no args)');
    const component = $elem.component();

    console.log(`  Getter returned type: ${typeof component}`);
    console.log(`  Is Jqhtml_Component: ${component instanceof Jqhtml_Component}`);
    console.log(`  Has .args property: ${component.args !== undefined}`);
    console.log(`  Has .data property: ${component.data !== undefined}`);
    console.log(`  Component args.user_id: ${component.args.user_id}`);

    const is_component = component instanceof Jqhtml_Component;
    const has_args = component.args !== undefined && component.args.user_id === 123;

    if (is_component && has_args) {
      console.log('✅ PASS: Getter returned component instance with correct args');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Getter did not return proper component instance');
      tests.push(false);
    }
    console.log('');

    // TEST 3: Verify component lifecycle completed
    console.log('TEST 3: Component lifecycle');
    const has_cid = component._cid !== undefined;
    const has_jquery = component.$ !== undefined;

    console.log(`  Has _cid: ${has_cid}`);
    console.log(`  Has this.$: ${has_jquery}`);
    console.log(`  Component ready: ${has_cid && has_jquery}`);

    if (has_cid && has_jquery) {
      console.log('✅ PASS: Component lifecycle completed');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Component lifecycle incomplete');
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
