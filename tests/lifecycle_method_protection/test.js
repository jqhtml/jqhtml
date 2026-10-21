/**
 * lifecycle_method_protection - each child runs one check in its on_ready() and writes
 * "✅ PASS ..." or "❌ FAIL ..." to its own status element. Children are ready before
 * this component's on_ready(), so every status is final here; this turns them into the
 * verdict.
 */
class Test_Lifecycle_Method_Protection extends Jqhtml_Component {
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

    const checks = [
      ['t1', 'Test 1: manual on_create() throws'],
      ['t2', 'Test 2: manual on_load() throws'],
      ['t3', 'Test 3: manual on_ready() throws'],
      ['t4', 'Test 4: manual on_render() throws'],
      ['t5', 'Test 5: manual on_stop() throws'],
      ['t6', 'Test 6: framework runs create, render, on_load/on_loaded, render, ready in order'],
      ['t7', "Test 7: a parent cannot call a child's on_load()"]
    ];
    for (const [sid, name] of checks) {
      const child = this.sid(sid);
      const status = child ? child.$sid('status').text().trim() : '(component missing)';
      assert(name, status.startsWith('✅ PASS'), status);
    }

    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
