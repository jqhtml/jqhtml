class Simple_Slot_Test extends Jqhtml_Component {
  on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    const assert = (name, condition) => {
      if (condition) { console.log('   PASS: ' + name); passed++; }
      else { console.log('   FAIL: ' + name); failed++; }
    };

    const parent = this.$.find('.Parent_Component').component();
    const child = this.$.find('.Child_Component').component();
    const header = this.$.find('.alert-info');
    const body = this.$.find('.alert-success');

    console.log('');
    console.log('1. BOTH NAMED SLOTS RENDERED:');
    assert('the child component mounted', child instanceof Jqhtml_Component);
    assert('header slot content is in the document', header.length === 1);
    assert('body slot content is in the document', body.length === 1);
    assert('header slot text came through', header.text().includes('This is the HEADER slot'));
    assert('body slot text came through', body.text().includes('This is the BODY slot'));

    console.log('');
    console.log("2. THEY RENDERED AT THE CHILD'S content() CALL SITES, IN ORDER:");
    assert('header slot is inside the child', header.closest(child.$).length === 1);
    assert('body slot is inside the child', body.closest(child.$).length === 1);
    assert('header renders before body', header.index() < body.index()
      || header[0].compareDocumentPosition(body[0]) & Node.DOCUMENT_POSITION_FOLLOWING);
    assert('header follows its "Rendering Header Slot:" heading',
      header.prevAll('h5').first().text().includes('Rendering Header Slot'));
    assert('body follows its "Rendering Body Slot:" heading',
      body.prevAll('h5').first().text().includes('Rendering Body Slot'));

    console.log('');
    console.log('3. SLOT MARKUP BELONGS TO THE PARENT THAT WROTE IT:');
    assert('slot content is NOT duplicated', this.$.find('.alert-info').length === 1);
    assert('the parent element still contains the child', parent && parent.$.find('.Child_Component').length === 1);

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
