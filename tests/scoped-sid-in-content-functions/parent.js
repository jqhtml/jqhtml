class Parent_Component extends Jqhtml_Component {
  on_create() {
    this.data.parent_value = 'DATA_FROM_PARENT';
  }

  on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    const assert = (name, condition) => {
      if (condition) { console.log('   PASS: ' + name); passed++; }
      else { console.log('   FAIL: ' + name); failed++; }
    };

    const child = this.sid('child');
    const $el = this.$sid('element_defined_in_parent');

    console.log('');
    console.log('1. CONTENT WRITTEN BY THE PARENT IS SCOPED TO THE PARENT:');
    assert('parent resolves its own $sid through the child', $el.length === 1);
    assert('the id carries the PARENT cid', $el.attr('id') === `element_defined_in_parent:${this._cid}`);
    assert('the id does NOT carry the child cid', child && $el.attr('id') !== `element_defined_in_parent:${child._cid}`);
    assert('the child does not resolve it as its own', child && child.$sid('element_defined_in_parent').length === 0);

    console.log('');
    console.log('2. THE ELEMENT STILL RENDERS INSIDE THE CHILD:');
    assert('element is a descendant of the child element', child && $el.closest(child.$).length === 1);
    assert('it landed in the child content area', $el.closest('.child-content-area').length === 1);

    console.log('');
    console.log('3. `this` INSIDE THE CONTENT IS THE PARENT:');
    assert('interpolation read the PARENT data', $el.find('.parent-this-data').text() === 'DATA_FROM_PARENT');
    assert('interpolated cid is the parent cid', $el.find('.expected-parent-cid').text() === this._cid);
    assert('the child rendered its OWN data', child && child.$.find('#child-data').text() === 'DATA_FROM_CHILD');

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
