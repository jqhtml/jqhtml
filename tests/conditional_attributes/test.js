/**
 * conditional_attributes - `<% if (cond) { %>attr="value"<% } %>` inside a tag.
 *
 * The harness mounts this component with {} - the "off" variant, where every condition
 * is false. Its on_ready() then mounts a second instance with every condition true (the
 * "on" variant) and asserts both: each attribute is present exactly when its condition
 * holds, with the interpolated value.
 */
const CONDITIONAL_ON_ARGS = {
  variant: 'on',
  required: true,
  disabled: true,
  readonly: true,
  min: 0,              // 0 !== undefined: a falsy value that still passes the condition
  max: 10,
  active: true,
  status_class: 'status-ok',
  test1: true,
  test2: true,
  test3: true,
  placeholder: 'Your name',
  value: 'abc',
  max_length: 5,
  button_disabled: true,
  button_primary: true,
  button_class: 'btn-x'
};

class Test_Conditional_Attributes extends Jqhtml_Component {
  async on_ready() {
    if (this.args.variant === 'on') return;   // the instance mounted below

    let passed = 0;
    let failed = 0;
    const assert = (name, condition, detail) => {
      if (condition) {
        console.log('   PASS: ' + name);
        passed++;
      } else {
        console.log('   FAIL: ' + name + (detail !== undefined ? ' - got ' + JSON.stringify(detail) : ''));
        failed++;
      }
    };

    const $on = $('<div>').appendTo(document.body).component('Test_Conditional_Attributes', CONDITIONAL_ON_ARGS);
    const on = $on.component();
    await on.ready();

    const check = (label, comp, expect_on) => {
      console.log('');
      console.log(label + ':');
      const attr = (sid, selector, name) => comp.$sid(sid).find(selector).attr(name);
      const has = (sid, selector, name) => attr(sid, selector, name) !== undefined;

      // Test 1
      assert('T1 required present=' + expect_on, has('test1', 'input', 'required') === expect_on);
      if (expect_on) assert('T1 required="required"', attr('test1', 'input', 'required') === 'required');
      assert('T1 static class kept', attr('test1', 'input', 'class') === 'form-control', attr('test1', 'input', 'class'));

      // Test 2
      for (const name of ['required', 'disabled', 'readonly']) {
        assert('T2 ' + name + ' present=' + expect_on, has('test2', 'input', name) === expect_on);
      }

      // Test 3
      if (expect_on) {
        assert('T3 min="0" (falsy value, condition !== undefined)', attr('test3', 'input', 'min') === '0', attr('test3', 'input', 'min'));
        assert('T3 max="10"', attr('test3', 'input', 'max') === '10', attr('test3', 'input', 'max'));
      } else {
        assert('T3 no min, no max', !has('test3', 'input', 'min') && !has('test3', 'input', 'max'));
      }
      assert('T3 type="number" kept', attr('test3', 'input', 'type') === 'number');

      // Test 4
      const t4_class = attr('test4', 'div', 'class');
      if (expect_on) {
        assert('T4 class="status status-ok active"', t4_class === 'status status-ok active', t4_class);
      } else {
        assert('T4 no class attribute', t4_class === undefined, t4_class);
      }

      // Test 5 - three whitespace styles
      const t5 = comp.$sid('test5').find('input');
      assert('T5 three inputs rendered', t5.length === 3, t5.length);
      ['data-test1', 'data-test2', 'data-test3'].forEach((name, i) => {
        const value = t5.eq(i).attr(name);
        assert('T5 ' + name + (expect_on ? '="yes"' : ' absent'), expect_on ? value === 'yes' : value === undefined, value);
      });

      // Test 6 - regular attributes plus conditional ones
      const $t6 = comp.$sid('test6').find('input');
      assert('T6 regular attributes kept',
        $t6.attr('id') === 'my-input' && $t6.attr('name') === 'username' && $t6.attr('type') === 'text');
      if (expect_on) {
        assert('T6 placeholder="Your name"', $t6.attr('placeholder') === 'Your name', $t6.attr('placeholder'));
        assert('T6 required present', $t6.attr('required') === 'required');
      } else {
        assert('T6 no placeholder, no required', $t6.attr('placeholder') === undefined && $t6.attr('required') === undefined);
      }

      // Test 7 - complex conditions
      if (expect_on) {
        assert('T7 value="abc"', attr('test7', 'input', 'value') === 'abc', attr('test7', 'input', 'value'));
        assert('T7 maxlength="5"', attr('test7', 'input', 'maxlength') === '5', attr('test7', 'input', 'maxlength'));
      } else {
        assert('T7 no value, no maxlength', !has('test7', 'input', 'value') && !has('test7', 'input', 'maxlength'));
      }

      // Test 8 - conditional $ attributes on a component tag
      const button = comp.$sid('test8').find('.Undefined_Button').component();
      assert('T8 component instance exists', !!button);
      if (button) {
        assert('T8 $label="Click Me" always', button.args.label === 'Click Me', button.args.label);
        if (expect_on) {
          assert('T8 $disabled=true (boolean)', button.args.disabled === true, button.args.disabled);
          assert('T8 $variant="primary"', button.args.variant === 'primary', button.args.variant);
          assert('T8 $custom_class=this.args.button_class', button.args.custom_class === 'btn-x', button.args.custom_class);
        } else {
          assert('T8 no disabled/variant/custom_class args',
            button.args.disabled === undefined && button.args.variant === undefined && button.args.custom_class === undefined,
            button.args);
        }
      }

      // Test 9 - bare boolean attribute; the condition is a literal, so both variants agree
      assert('T9 if (true) -> disabled present', comp.$sid('test9_true').attr('disabled') !== undefined);
      assert('T9 if (false) -> disabled absent', comp.$sid('test9_false').attr('disabled') === undefined);
    };

    check('OFF VARIANT (mounted with {})', this, false);
    check('ON VARIANT (every condition true)', on, true);

    console.log('');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
