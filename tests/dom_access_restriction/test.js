/**
 * dom_access_restriction - on_load() runs on a restricted `this`: this.data (write) and
 * this.args (read) work; this.$, this.$sid(), this.sid(), component_name() and setting
 * any other property throw. Each child records what happened in this.data; this
 * component turns that into the verdict once every child is ready.
 */
class Test_DOM_Access_Restriction extends Jqhtml_Component {
  on_ready() {
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
    const data = (sid) => (this.sid(sid) ? this.sid(sid).data : {});

    assert('Test 1: on_load() can set this.data', data('t1').message === 'Success!', data('t1'));

    const blocked = [
      ['t2', 'Test 2: this.$ throws', 'Cannot access this.$ during on_load()'],
      ['t3', 'Test 3: this.$sid() throws', 'Cannot access this.$sid during on_load()'],
      ['t4', 'Test 4: this.sid() throws', 'Cannot access this.sid during on_load()'],
      ['t5', 'Test 5: setting this.custom_prop throws', 'Cannot modify this.custom_prop during on_load()'],
      ['t7', 'Test 7: this.component_name() throws', 'Cannot access this.component_name during on_load()']
    ];
    for (const [sid, name, message] of blocked) {
      const d = data(sid);
      assert(name, d.pass === true && typeof d.error === 'string' && d.error.includes(message), d);
    }

    assert('Test 6: on_load() can read this.args.user_id (42)',
      data('t6').pass === true && data('t6').user_id === 42, data('t6'));

    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
