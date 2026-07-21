/**
 * Undefined_Component_Tag_Override
 *
 * Target: instruction-processor.ts ~294
 *   const tagName = props._tag || template.tag || 'div';
 * and component-registry.ts DEFAULT_TEMPLATE (tag: 'div').
 *
 * Never_Defined_Component is NEVER registered (no register_component/
 * register_template call anywhere in this test). Asserts:
 *   1. <Never_Defined_Component tag="nav" /> renders as <nav>
 *   2. That element gets class="Never_Defined_Component Component"
 *   3. <Never_Defined_Component /> (no tag=) renders as <div>
 *   4. That element also gets class="Never_Defined_Component Component"
 *
 * This test is cache-mode agnostic - the tag/class resolution happens on
 * every render in all 3 modes (none/data/html), so no mode conditional is
 * needed; the same assertions run and must pass identically everywhere.
 */
class Undefined_Component_Tag_Override_Main extends Jqhtml_Component {
  async on_ready() {
    const cacheMode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';

    console.log('========================================');
    console.log('TESTING UNDEFINED COMPONENT TAG OVERRIDE:');
    console.log(`Cache mode: ${cacheMode}`);
    console.log('========================================');

    const tests = [];

    // TEST 1: tag="nav" override on an unregistered component -> <nav>
    const $with_tag = this.$sid('with_tag');
    const tag1 = $with_tag.length ? $with_tag[0].tagName.toLowerCase() : null;
    if (tag1 === 'nav') {
      console.log('✅ TEST 1 PASS: tag="nav" override renders unregistered component as <nav>');
      tests.push(true);
    } else {
      console.log(`❌ TEST 1 FAIL: expected <nav>, got <${tag1}>`);
      tests.push(false);
    }

    // TEST 2: element gets "ComponentName Component" classes
    const classes1 = $with_tag.attr('class') || '';
    if (classes1 === 'Never_Defined_Component Component') {
      console.log('✅ TEST 2 PASS: tag override element has class="Never_Defined_Component Component"');
      tests.push(true);
    } else {
      console.log(`❌ TEST 2 FAIL: expected class="Never_Defined_Component Component", got "${classes1}"`);
      tests.push(false);
    }

    // TEST 3: no tag= override -> falls back to DEFAULT_TEMPLATE.tag ('div')
    const $without_tag = this.$sid('without_tag');
    const tag2 = $without_tag.length ? $without_tag[0].tagName.toLowerCase() : null;
    if (tag2 === 'div') {
      console.log('✅ TEST 3 PASS: no tag= override defaults unregistered component to <div>');
      tests.push(true);
    } else {
      console.log(`❌ TEST 3 FAIL: expected <div>, got <${tag2}>`);
      tests.push(false);
    }

    // TEST 4: default div also gets "ComponentName Component" classes
    const classes2 = $without_tag.attr('class') || '';
    if (classes2 === 'Never_Defined_Component Component') {
      console.log('✅ TEST 4 PASS: default <div> has class="Never_Defined_Component Component"');
      tests.push(true);
    } else {
      console.log(`❌ TEST 4 FAIL: expected class="Never_Defined_Component Component", got "${classes2}"`);
      tests.push(false);
    }

    console.log('');
    if (tests.every((t) => t)) {
      console.log('✅ ALL TESTS PASSED');
      $('#results').html('<span style="color: green;">✅ All tests passed</span>');
    } else {
      console.log('❌ SOME TESTS FAILED');
      $('#results').html('<span style="color: red;">❌ Some tests failed</span>');
    }
    console.log('========================================');
  }
}
