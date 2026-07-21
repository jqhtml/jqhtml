class Test_Container extends Jqhtml_Component {
  on_ready() {
    console.log('');
    console.log('========================================');
    console.log('content() INSTRUCTION FLATTENING TEST:');
    console.log('========================================');
    console.log('');

    const tests = [];
    const wrapper = this.sid('wrapper');

    // TEST 1: Inner components created (not stringified)
    console.log('TEST 1: Component instances created');
    const inner_components = wrapper.$.find('.Inner');
    console.log(`  Found .Inner components: ${inner_components.length}`);
    console.log(`  Expected: 2`);

    if (inner_components.length === 2) {
      console.log('✅ PASS: Two Inner component instances created');
      tests.push(true);
    } else {
      console.log(`❌ FAIL: Expected 2 Inner components, found ${inner_components.length}`);
      tests.push(false);
    }
    console.log('');

    // TEST 2: Inner components have correct structure
    console.log('TEST 2: Component structure preserved');
    const first_inner = inner_components.eq(0);
    const has_span = first_inner.find('span.inner').length > 0;
    const correct_text = first_inner.find('span.inner').text() === 'Inner Component';

    console.log(`  First Inner has <span class="inner">: ${has_span}`);
    console.log(`  Correct text content: ${correct_text}`);

    if (has_span && correct_text) {
      console.log('✅ PASS: Component structure preserved (not stringified)');
      tests.push(true);
    } else {
      console.log('❌ FAIL: Component structure not preserved correctly');
      tests.push(false);
    }
    console.log('');

    // TEST 3: Text content preserved
    console.log('TEST 3: Text content preserved');
    const paragraph = wrapper.$.find('p');
    const p_text = paragraph.text().trim();
    console.log(`  Found <p> element: ${paragraph.length > 0}`);
    console.log(`  Text: "${p_text}"`);
    console.log(`  Expected: "Text content"`);

    if (p_text === 'Text content') {
      console.log('✅ PASS: Text content preserved');
      tests.push(true);
    } else {
      console.log(`❌ FAIL: Expected "Text content", got "${p_text}"`);
      tests.push(false);
    }
    console.log('');

    // TEST 4: Component hierarchy (Inner components are inside Wrapper)
    console.log('TEST 4: Component hierarchy');
    const wrapper_el = this.$sid('wrapper');
    const inner_inside_wrapper = wrapper_el.find('.Inner').length;
    console.log(`  Inner components inside Wrapper: ${inner_inside_wrapper}`);
    console.log(`  Expected: 2`);

    if (inner_inside_wrapper === 2) {
      console.log('✅ PASS: Component hierarchy preserved');
      tests.push(true);
    } else {
      console.log(`❌ FAIL: Expected 2 Inner inside Wrapper, got ${inner_inside_wrapper}`);
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
