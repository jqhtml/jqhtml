/**
 * Unified_Register_Api_Test
 *
 * Behavioral test for jqhtml.register() (packages/core/src/component-registry.ts:349-389).
 *
 * This is the ONLY component in the test bundle - the test-runner registers it as
 * the main template/class as usual (via register_template/register_component), and
 * ITS OWN on_ready() then drives the actual assertions about the unified register()
 * API by calling window.jqhtml.register() directly on ad-hoc template objects and
 * classes constructed inline. This exercises register() itself rather than the
 * test-runner's normal registration path.
 *
 * register() behavior under test (all three branches):
 *   1. register(template_object) where template_object.__jqhtml_template === true
 *      -> delegates to register_template(), keyed by template.name
 *   2. register(SomeClass) where SomeClass extends Jqhtml_Component (inherits the
 *      static __jqhtml_component = true marker) and has NO static component_name
 *      -> delegates to register_component(), keyed by the class's own .name
 *   3. register(SomeClass) where SomeClass has static component_name = 'Other_Name'
 *      -> delegates to register_component(), keyed by 'Other_Name', NOT the class name
 *
 * Register() behavior is pure registry bookkeeping - it does not depend on caching,
 * so this test runs the same assertions unconditionally in all three cache modes
 * (none/data/html).
 */

class Unified_Register_Api_Test extends Jqhtml_Component {
  on_create() {
    this.state.test_results = [];
  }

  async on_ready() {
    const cacheMode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';

    console.log('========================================');
    console.log('UNIFIED REGISTER API TEST');
    console.log(`Cache mode: ${cacheMode}`);
    console.log('========================================');

    await this.test_1_register_template();
    await this.test_2_register_class_by_class_name();
    await this.test_3_register_class_with_static_component_name();

    this.display_results();
  }

  add_result(description, passed) {
    this.state.test_results.push({ description, passed });
    const n = this.state.test_results.length;
    console.log(`${passed ? `✅ TEST ${n} PASS` : `❌ TEST ${n} FAIL`}: ${description}`);
  }

  // ------------------------------------------------------------------
  // TEST 1: register() with a compiled TEMPLATE object
  // ------------------------------------------------------------------
  async test_1_register_template() {
    const template_obj = {
      __jqhtml_template: true,
      _jqhtml_version: 'test',
      name: 'Register_Api_Template_Test',
      tag: 'div',
      defaultAttributes: {},
      render: function(data, args, content) {
        const _output = [];
        _output.push({ tag: ['span', { class: 'template-marker' }, false] });
        _output.push('registered-via-template-object');
        _output.push('</span>');
        return [_output, this];
      },
      dependencies: []
    };

    let threw = null;
    try {
      window.jqhtml.register(template_obj);
    } catch (e) {
      threw = e;
    }
    this.add_result(
      'register(template_object) does not throw',
      threw === null
    );

    const registered_templates = window.jqhtml.get_registered_templates();
    this.add_result(
      "get_registered_templates() includes 'Register_Api_Template_Test' after register(template_object)",
      registered_templates.includes('Register_Api_Template_Test')
    );

    // Instantiate it via $().component() and confirm the DOM actually reflects
    // the template we registered through register(), not some fallback.
    const $el = $('<div>').appendTo('body').component('Register_Api_Template_Test', {});
    const instance = $el.component();
    await instance.ready();

    const html = $el.html();
    this.add_result(
      'component instantiated from register()-ed template renders its own markup',
      html.includes('registered-via-template-object') && $el.find('span.template-marker').length === 1
    );

    $el.remove();
  }

  // ------------------------------------------------------------------
  // TEST 2: register() with a CLASS - uses the class name when there is
  // no static component_name override
  // ------------------------------------------------------------------
  async test_2_register_class_by_class_name() {
    class Register_Api_Class_Test extends Jqhtml_Component {
      on_create() {
        this.data.marker = 'class-name-registration';
      }
    }

    // Sanity: this class inherits __jqhtml_component from Jqhtml_Component and
    // has no static component_name - that's the exact input register() must
    // route to register_component() keyed by class.name.
    this.add_result(
      'test class inherits static __jqhtml_component marker',
      Register_Api_Class_Test.__jqhtml_component === true
    );
    this.add_result(
      'test class has no static component_name override',
      Register_Api_Class_Test.component_name === undefined
    );

    let threw = null;
    try {
      window.jqhtml.register(Register_Api_Class_Test);
    } catch (e) {
      threw = e;
    }
    this.add_result(
      'register(class) does not throw',
      threw === null
    );

    this.add_result(
      "has_component('Register_Api_Class_Test') is true (registered under the class name)",
      window.jqhtml.has_component('Register_Api_Class_Test') === true
    );
    this.add_result(
      "get_component_class('Register_Api_Class_Test') returns the exact class object",
      window.jqhtml.get_component_class('Register_Api_Class_Test') === Register_Api_Class_Test
    );

    // Instantiate (no template registered for this name -> default div template,
    // but the class's on_create still runs and sets this.data.marker)
    const $el = $('<div>').appendTo('body').component('Register_Api_Class_Test', {});
    const instance = $el.component();
    await instance.ready();

    this.add_result(
      'instantiated component is an instance of the registered class',
      instance instanceof Register_Api_Class_Test
    );
    this.add_result(
      "instantiated component ran the registered class's on_create()",
      instance.data.marker === 'class-name-registration'
    );

    $el.remove();
  }

  // ------------------------------------------------------------------
  // TEST 3: register() with a CLASS that declares static component_name -
  // must register under that name, NOT the class's own name
  // ------------------------------------------------------------------
  async test_3_register_class_with_static_component_name() {
    class Register_Api_Renamed_Class extends Jqhtml_Component {
      static component_name = 'Register_Api_Other_Name';

      on_create() {
        this.data.marker = 'static-component-name-registration';
      }
    }

    let threw = null;
    try {
      window.jqhtml.register(Register_Api_Renamed_Class);
    } catch (e) {
      threw = e;
    }
    this.add_result(
      'register(class-with-static-component_name) does not throw',
      threw === null
    );

    this.add_result(
      "has_component('Register_Api_Other_Name') is true (registered under static component_name)",
      window.jqhtml.has_component('Register_Api_Other_Name') === true
    );
    this.add_result(
      "has_component('Register_Api_Renamed_Class') is FALSE (NOT registered under the class's own name)",
      window.jqhtml.has_component('Register_Api_Renamed_Class') === false
    );
    this.add_result(
      "get_component_class('Register_Api_Other_Name') returns the exact class object",
      window.jqhtml.get_component_class('Register_Api_Other_Name') === Register_Api_Renamed_Class
    );

    // Instantiate using the static component_name, not the class name
    const $el = $('<div>').appendTo('body').component('Register_Api_Other_Name', {});
    const instance = $el.component();
    await instance.ready();

    this.add_result(
      'instantiated via static component_name is an instance of the registered class',
      instance instanceof Register_Api_Renamed_Class
    );
    this.add_result(
      "instantiated via static component_name ran the registered class's on_create()",
      instance.data.marker === 'static-component-name-registration'
    );

    $el.remove();
  }

  // ------------------------------------------------------------------

  display_results() {
    const $results = this.$sid('results');
    let html = '<h2>Test Results</h2><ul>';

    for (const result of this.state.test_results) {
      const icon = result.passed ? '✅' : '❌';
      html += `<li>${icon} ${result.description}</li>`;
    }
    html += '</ul>';

    const all_passed = this.state.test_results.every(r => r.passed);
    html += `<h3>${all_passed ? '✅ All tests passed!' : '❌ Some tests failed'}</h3>`;

    this.$sid('status').html(all_passed ? '<span style="color: green;">PASSED</span>' : '<span style="color: red;">FAILED</span>');
    $results.html(html);

    window.testPassed = all_passed;

    console.log('========================================');
    console.log('FINAL RESULTS:');
    for (const result of this.state.test_results) {
      console.log(`  ${result.passed ? 'PASS' : 'FAIL'}: ${result.description}`);
    }
    console.log('');
    if (all_passed) {
      console.log('✅ ALL TESTS PASSED');
    } else {
      console.log('❌ SOME TESTS FAILED');
    }
    console.log('========================================');
  }
}
