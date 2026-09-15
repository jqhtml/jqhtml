class Test_Dynamic_Tags extends Jqhtml_Component {
  on_create() {
    this.state.editor = 'Dt_Text_Input';
    this.state.missing = 'Dt_Not_Defined';
    this.state.wrapper = 'Dt_Panel';
    this.state.inner = 'Dt_Wysiwyg_Input';
    this.state.n = 5;
  }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;
    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const name_of = (sid) => { const c = this.sid(sid); return c ? c.component_name() : null; };

    console.log('');
    console.log('1. A DYNAMIC TAG MOUNTS THE COMPONENT THE EXPRESSION NAMES:');
    assert('<{this.state.editor}> mounted Dt_Text_Input', name_of('editor') === 'Dt_Text_Input');
    assert('args arrived ($field)', this.sid('editor').args.field === 'title');
    assert('it rendered its own template', this.$sid('editor').find('input[type=text]').length === 1);
    assert('a > inside the expression does not end the tag (ternary)', name_of('ternary_editor') === 'Dt_Text_Input');

    console.log('');
    console.log('2. AN UNDEFINED-BUT-VALID NAME RENDERS THE SAME PLACEHOLDER A LITERAL TAG DOES:');
    const dyn = this.$sid('missing'), lit = this.$sid('literal_missing');
    assert('dynamic placeholder exists as a div', dyn.length === 1 && dyn.prop('tagName') === 'DIV');
    assert('carries its name and Component classes', dyn.hasClass('Dt_Not_Defined') && dyn.hasClass('Component'));
    assert('same class shape as the literal undefined tag', lit.hasClass('Dt_Not_Defined_Either') && lit.hasClass('Component') && dyn.prop('tagName') === lit.prop('tagName'));
    assert('is a live component instance', this.sid('missing') instanceof Jqhtml_Component);

    console.log('');
    console.log('3. CONTENT REACHES content() AND NESTED DYNAMIC COMPONENTS HYDRATE:');
    const wrapper = this.sid('wrapper');
    assert('<{wrapper}>...</{wrapper}> mounted Dt_Panel', wrapper && wrapper.component_name() === 'Dt_Panel');
    assert('content landed inside the panel body', wrapper.$.find('.panel-body b').text() === 'wrapped');
    assert('$sid inside the content scopes to this component', this.$sid('inner_b').length === 1);
    const nested = this.sid('nested');
    assert('nested dynamic component hydrated -> ' + (nested && nested.component_name()), nested && nested.component_name() === 'Dt_Wysiwyg_Input');
    assert('nested component is ready and rendered', nested && nested.$.find('textarea').length === 1);
    assert('nested component sits inside the outer dynamic one', nested && wrapper.$.find(nested.$).length === 1);

    console.log('');
    console.log('4. INSIDE A FORM IT LANDS IN THE REAL DOM POSITION WITH NO WRAPPER:');
    const form_editor = this.$sid('form_editor');
    assert('component element is a direct child of the form', form_editor.parent()[0] === this.$sid('form')[0]);
    assert('it sits between the label and the button', form_editor.prev().is('label') && form_editor.next().is('button'));
    assert('form discovers its input', this.$sid('form')[0].elements.namedItem('form_title') !== null);

    console.log('');
    console.log('5. CHANGING THE EXPRESSION VALUE MOUNTS A DIFFERENT COMPONENT ON RE-RENDER:');
    this.state.editor = 'Dt_Wysiwyg_Input';
    await this.render();
    assert('after render the editor is Dt_Wysiwyg_Input', name_of('editor') === 'Dt_Wysiwyg_Input');
    assert('its template rendered (textarea)', this.$sid('editor').find('textarea').length === 1);
    assert('the old component is gone from the host', this.$sid('editor_host').find('.Dt_Text_Input').length === 0);

    console.log('');
    console.log('6. INVALID NAMES THROW AT RENDER:');
    const original_error = console.error;
    for (const [bad, label] of [['', 'empty string'], ['text_input', 'lowercase initial'], ['Dt-Input', 'disallowed character'], [undefined, 'undefined']]) {
      const boot_errors = [];
      console.error = (...a) => { boot_errors.push(a.map(String).join(' ')); original_error.apply(console, a); };
      $('<div>').component('Dt_Dynamic_Probe', { name: bad }).appendTo(this.$);
      await new Promise((r) => setTimeout(r, 200));
      console.error = original_error;
      assert(label + ' throws a dynamic-name error', boot_errors.some((m) => /Dynamic component tag <\{\.\.\.\}> evaluated to/.test(m)));
    }
    for (const good of ['Dt_Text_Input', '_Dt_Prefixed']) {
      const c = $('<div>').component('Dt_Dynamic_Probe', { name: good }).appendTo(this.$).component();
      await c.ready();
      assert(good + ' is accepted', c.$.find('.' + good).length === 1);
    }

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
