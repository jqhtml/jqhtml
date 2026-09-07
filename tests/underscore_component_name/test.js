class Test_Underscore_Component_Name extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    function assert(name, condition) {
      if (condition) { console.log('   PASS: ' + name); passed++; }
      else { console.log('   FAIL: ' + name); failed++; }
    }

    const fbox = this.sid('fbox');

    console.log('');
    console.log('1. <Define:_Foo> DEFINES AND <_Foo> RESOLVES:');
    assert('<_Framework_Box> mounted as a component', fbox instanceof Jqhtml_Component);
    assert('its JS class is _Framework_Box', fbox && fbox.constructor.name === '_Framework_Box');
    assert('its template rendered ($label arg visible)', fbox && fbox.$.find('.fw-label').text() === 'from template');
    assert('component_name() is _Framework_Box', fbox && fbox.component_name() === '_Framework_Box');

    console.log('');
    console.log('2. RENDERED ELEMENT CARRIES THE CLASS NAME UNCHANGED:');
    assert('root has class _Framework_Box', fbox && fbox.$.hasClass('_Framework_Box'));
    assert('root has class Component', fbox && fbox.$.hasClass('Component'));
    assert('styling class from Define is kept', fbox && fbox.$.hasClass('fw-box'));
    assert('$(".\\_Framework_Box").component() finds it', $('._Framework_Box').first().component() === fbox);

    console.log('');
    console.log('3. NESTING IN BOTH DIRECTIONS AND SELF-CLOSING:');
    const fw_in_fw = this.sid('fw_in_fw');
    const plain_in_fw = this.sid('plain_in_fw');
    const fw_in_plain = this.sid('fw_in_plain');
    const self_closed = this.sid('self_closed');
    assert('<_Framework_Marker/> inside <_Framework_Box>', fw_in_fw && fw_in_fw.$.hasClass('_Framework_Marker'));
    assert('<Plain_Marker/> inside <_Framework_Box>', plain_in_fw && plain_in_fw.$.hasClass('Plain_Marker'));
    assert('<_Framework_Marker/> inside <Plain_Box>', fw_in_plain && fw_in_plain.$.hasClass('_Framework_Marker'));
    assert('self-closing <_Framework_Marker /> at top level', self_closed && self_closed.$.is('span._Framework_Marker'));
    assert('content() of _Framework_Box received both children', fbox && fbox.$.find('.fw-content .Component').length === 2);
    assert('instantiator() of the nested marker is this test component', fw_in_fw && fw_in_fw.instantiator() === this);

    console.log('');
    console.log('4. REGISTER BY NAME AND PROGRAMMATIC CREATION:');
    let register_error = null;
    try {
      window.jqhtml.register_component('_Registered_By_Name', class _Registered_By_Name extends Jqhtml_Component {});
    } catch (e) { register_error = e; }
    assert('register_component("_Registered_By_Name", cls) does not throw', register_error === null);
    const mounted = this.$sid('mount').component('_Registered_By_Name', {}).component();
    await mounted.ready();
    assert('$(el).component("_Registered_By_Name") mounts it', mounted instanceof Jqhtml_Component);
    assert('mounted element carries class _Registered_By_Name', mounted.$.hasClass('_Registered_By_Name'));
    assert('closest("_Framework_Box") accepts the underscore name', fw_in_fw && fw_in_fw.closest('_Framework_Box') === fbox);

    console.log('');
    console.log('5. REPLACEMENT STRIPS THE UNDERSCORE COMPONENT CLASS:');
    mounted.$.component('Plain_Marker', {});
    const replaced = mounted.$.component();
    await replaced.ready();
    assert('old class _Registered_By_Name removed on replacement', !mounted.$.hasClass('_Registered_By_Name'));
    assert('new class Plain_Marker present', mounted.$.hasClass('Plain_Marker'));

    console.log('');
    console.log('6. TWO LEADING UNDERSCORES AND UNDERSCORE+LOWERCASE ARE REJECTED:');
    const rule = /must start with a capital letter, optionally preceded by a single underscore/;
    let e1 = null, e2 = null;
    try { window.jqhtml.register_component('__Double', class __Double extends Jqhtml_Component {}); } catch (e) { e1 = e; }
    try { window.jqhtml.register_component('_lower', class _lower extends Jqhtml_Component {}); } catch (e) { e2 = e; }
    assert('__Double rejected with the naming rule', e1 !== null && rule.test(e1.message));
    assert('_lower rejected with the naming rule', e2 !== null && rule.test(e2.message));

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
