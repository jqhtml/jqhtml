class Data_Persistence_Test extends Jqhtml_Component {
  on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    const assert = (name, condition) => {
      if (condition) { console.log('   PASS: ' + name); passed++; }
      else { console.log('   FAIL: ' + name); failed++; }
    };

    const c = this.$.find('.Component_With_Create_Data').component();
    const seen = window.__dp_seen || {};

    console.log('');
    console.log('1. this.data SET IN on_create() SURVIVES TO EVERY LATER PHASE:');
    assert('this.data.foo is readable in on_ready()', c && c.data.foo === 'bar');
    assert('on_render() saw it', seen.render === 'bar');
    assert('the template rendered it', c && c.$.text().includes('this.data.foo = bar'));
    assert('no component with no on_load() lost its on_create() data', c && Object.keys(c.data).length === 1);

    console.log('');
    console.log('2. this.data IS FROZEN ONCE on_create() HAS RETURNED:');
    assert('it was extensible DURING on_create()', seen.extensible_in_create === true);
    let threw = null;
    try { c.data.foo = 'changed'; } catch (e) { threw = e; }
    assert('writing from on_ready() throws', threw !== null);
    assert('the value is unchanged', c.data.foo === 'bar');

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
