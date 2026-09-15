class Data_Freeze_Test extends Jqhtml_Component {
  on_create() {
    console.log('');
    console.log('========================================');
    console.log('THIS.DATA FREEZE/UNFREEZE CYCLE TEST:');
    console.log('========================================');
    console.log('');

    // Test bookkeeping lives in this.state: it is appended from on_render() and
    // on_ready(), where this.data is frozen - and the freeze is DEEP, so pushing into
    // an array inside this.data throws exactly like assigning to this.data.
    this.state.test_results = [];

    const record = (test, status, details) => {
      this.state.test_results.push({ test, status, details });
    };
    this.state.record = record;

    // TEST 1: this.data writable in on_create()
    console.log('TEST 1: Modifying this.data in on_create()');
    try {
      this.data.initial = 'created';
      this.data.created_at = Date.now();
      // Nested writes are equally legal here - the freeze is off during on_create().
      this.data.nested = { list: [1], user: { name: 'a' } };
      this.data.nested.list.push(2);
      console.log('✅ PASS: Successfully set this.data.initial, this.data.created_at and nested values');
      record('on_create() can modify this.data, nested values included', 'PASS',
             'this.data.initial = "created", this.data.nested.list = [1,2]');
    } catch (e) {
      console.log('❌ FAIL: Could not modify this.data in on_create():', e.message);
      record('on_create() can modify this.data, nested values included', 'FAIL', e.message);
    }
    console.log('');
  }

  async on_load() {
    // TEST 3: this.data writable in on_load()
    // on_load() can reach neither this.state nor any other property, so the outcome is
    // carried out through this.data and turned into results in on_ready().
    console.log('TEST 3: Modifying this.data in on_load()');
    try {
      this.data.loaded = 'from_api';
      this.data.loaded_at = Date.now();
      console.log('✅ PASS: Successfully set this.data.loaded and this.data.loaded_at');
      this.data.load_write_ok = true;
    } catch (e) {
      console.log('❌ FAIL: Could not modify this.data in on_load():', e.message);
      this.data.load_write_ok = false;
    }

    // TEST 3b: nested writes are unfrozen in on_load() too
    console.log('TEST 3b: Modifying NESTED this.data in on_load()');
    try {
      this.data.nested.list.push(3);
      this.data.nested.user.name = 'b';
      console.log('✅ PASS: Successfully pushed to this.data.nested.list and set nested.user.name');
      this.data.load_nested_write_ok = true;
    } catch (e) {
      console.log('❌ FAIL: Could not modify nested this.data in on_load():', e.message);
      this.data.load_nested_write_ok = false;
    }
    console.log('');
  }

  on_render() {
    // TEST 2: this.data frozen after on_create() (on_render runs after on_create).
    // on_render() fires again after on_load() changes data - only check once.
    if (this.state.render_checked) return;
    this.state.render_checked = true;

    console.log('TEST 2: Attempting to modify this.data in on_render() (after on_create)');
    try {
      this.data.rendered = 'should_fail';
      console.log('❌ FAIL: Was able to modify this.data in on_render()');
      this.state.record('this.data frozen after on_create()', 'FAIL',
                        'Modification succeeded when it should have failed');
    } catch (e) {
      console.log('✅ PASS: Cannot modify this.data in on_render():', e.message);
      this.state.record('this.data frozen after on_create()', 'PASS', e.message);
    }

    console.log('TEST 2b: Attempting to modify NESTED this.data in on_render()');
    try {
      this.data.nested.list.push(99);
      console.log('❌ FAIL: Was able to push into this.data.nested.list in on_render()');
      this.state.record('nested this.data frozen after on_create()', 'FAIL',
                        'Nested mutation succeeded when it should have failed');
    } catch (e) {
      console.log('✅ PASS: Cannot push into this.data.nested.list in on_render():', e.message);
      this.state.record('nested this.data frozen after on_create()', 'PASS', e.message);
    }
    console.log('');
  }

  on_ready() {
    const record = this.state.record;

    // Results carried out of on_load() through this.data
    record('on_load() can modify this.data', this.data.load_write_ok ? 'PASS' : 'FAIL',
           'this.data.loaded = "from_api"');
    record('on_load() can modify NESTED this.data', this.data.load_nested_write_ok ? 'PASS' : 'FAIL',
           'this.data.nested.list.push(3), this.data.nested.user.name = "b"');

    // TEST 4: this.data frozen after on_load()
    console.log('TEST 4: Attempting to modify this.data in on_ready() (after on_load)');
    try {
      this.data.ready = 'should_fail';
      console.log('❌ FAIL: Was able to modify this.data in on_ready()');
      record('this.data frozen after on_load()', 'FAIL', 'Modification succeeded when it should have failed');
    } catch (e) {
      console.log('✅ PASS: Cannot modify this.data in on_ready():', e.message);
      record('this.data frozen after on_load()', 'PASS', e.message);
    }
    console.log('');

    // TEST 4b: the freeze after on_load() is deep as well
    console.log('TEST 4b: Attempting nested modifications in on_ready() (after on_load)');
    const nested_attempts = [
      ['this.data.nested.list.push(99)', () => this.data.nested.list.push(99)],
      ['this.data.nested.user.name = "z"', () => { this.data.nested.user.name = 'z'; }],
      ['delete this.data.nested.user.name', () => { delete this.data.nested.user.name; }],
      ['this.data.nested.list[0] = 42', () => { this.data.nested.list[0] = 42; }]
    ];
    for (const [label, attempt] of nested_attempts) {
      try {
        attempt();
        console.log('❌ FAIL: ' + label + ' succeeded');
        record('nested this.data frozen after on_load(): ' + label, 'FAIL', 'Mutation succeeded');
      } catch (e) {
        console.log('✅ PASS: ' + label + ' threw: ' + e.message);
        record('nested this.data frozen after on_load(): ' + label, 'PASS', e.message);
      }
    }
    console.log('');

    // TEST 5: Verify data persists correctly
    console.log('TEST 5: Verifying data persistence');
    const has_initial = this.data.initial === 'created';
    const has_loaded = this.data.loaded === 'from_api';
    const has_rendered = this.data.rendered !== undefined;
    const has_ready = this.data.ready !== undefined;
    // on_load()'s nested writes landed; on_render()/on_ready()'s did not.
    const nested_json = JSON.stringify(this.data.nested);
    const nested_correct = nested_json === '{"list":[1,2,3],"user":{"name":"b"}}';

    console.log('  this.data.initial:', this.data.initial, has_initial ? '✅' : '❌');
    console.log('  this.data.loaded:', this.data.loaded, has_loaded ? '✅' : '❌');
    console.log('  this.data.nested:', nested_json, nested_correct ? '✅' : '❌');
    console.log('  this.data.rendered:', this.data.rendered, has_rendered ? '(present)' : '(absent)');
    console.log('  this.data.ready:', this.data.ready, has_ready ? '(present)' : '(absent)');

    if (has_initial && has_loaded && nested_correct && !has_rendered && !has_ready) {
      console.log('✅ PASS: Data persists correctly (only the writes made in on_create()/on_load() landed)');
      record('Data persists correctly', 'PASS', 'initial, loaded and nested values present; rejected writes absent');
    } else {
      console.log('❌ FAIL: Data state incorrect');
      record('Data persists correctly', 'FAIL',
             `initial:${has_initial}, loaded:${has_loaded}, nested:${nested_json}, rendered:${has_rendered}, ready:${has_ready}`);
    }
    console.log('');

    // Final summary
    console.log('========================================');
    console.log('FINAL RESULT:');
    console.log('========================================');

    const all_passed = this.state.test_results.every(r => r.status === 'PASS');

    this.state.test_results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} ${result.test}`);
      console.log(`   ${result.details}`);
    });

    console.log('');

    if (all_passed) {
      console.log('✅ ALL FREEZE/UNFREEZE TESTS PASSED');
      console.log('   - this.data writable in on_create(), nested values included');
      console.log('   - this.data frozen after on_create(), DEEPLY');
      console.log('   - this.data writable in on_load(), nested values included');
      console.log('   - this.data frozen after on_load(), DEEPLY');
      console.log('   - Data persists correctly');
      this.$sid('results').html('<h3 style="color: green;">✅ All tests passed</h3>');
    } else {
      console.log('❌ SOME FREEZE/UNFREEZE TESTS FAILED');
      this.$sid('results').html('<h3 style="color: red;">❌ Some tests failed</h3>');
    }

    console.log('');
    console.log('========================================');
    console.log('');
  }
}
