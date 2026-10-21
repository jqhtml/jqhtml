class Test_Interpolated_Id_Attribute extends Jqhtml_Component {
  on_create() {
    this.state.value = 'v42';
    this.state.n = 1;
  }

  on_click() {}

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;
    let passed = 0, failed = 0;
    const assert = (name, ok) => { console.log('   ' + (ok ? 'PASS' : 'FAIL') + ': ' + name); ok ? passed++ : failed++; };
    const ids = this.$.find('p').map((i, el) => el.getAttribute('id')).get();

    console.log('');
    console.log('1. AN INTERPOLATED id IS CONCATENATED, NOT "[object Object]":');
    assert('id="x_<%= a || b %>" -> ' + JSON.stringify(ids[0]), ids[0] === 'x_v42');
    assert('id="row_<%= n > 0 ? ... %>_end" keeps precedence -> ' + JSON.stringify(ids[1]), ids[1] === 'row_pos_end');

    console.log('');
    console.log('2. A HAND-WRITTEN id IS NEVER CID-SCOPED:');
    assert('tracked (@click) interpolated id -> ' + JSON.stringify(ids[2]), ids[2] === 't_v42');
    assert('static id -> ' + JSON.stringify(ids[3]), ids[3] === 'plain_static');
    assert('no id contains "[object Object]" or ":"', ids.every(id => id.indexOf('[object') === -1 && id.indexOf(':') === -1));

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
