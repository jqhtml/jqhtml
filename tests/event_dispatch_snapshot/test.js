class Test_Event_Dispatch_Snapshot extends Jqhtml_Component {
  on_create() {
    this.state.test_results = [];
  }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;

    function assert(name, condition) {
      if (condition) {
        console.log('   PASS: ' + name);
        passed++;
      } else {
        console.log('   FAIL: ' + name);
        failed++;
      }
    }

    function assert_eq(name, actual, expected) {
      const a = JSON.stringify(actual);
      const e = JSON.stringify(expected);
      if (a === e) {
        console.log('   PASS: ' + name + ' -> ' + a);
        passed++;
      } else {
        console.log('   FAIL: ' + name + ' -> expected ' + e + ', got ' + a);
        failed++;
      }
    }

    const child = this.sid('child');

    // ============================================================
    // Test 1: Two pending once() on the same event both fire
    // ============================================================
    console.log('');
    console.log('1. TWO PENDING once() ON SAME EVENT:');

    const fired_1 = [];
    child.once('dispatch_evt_1', () => fired_1.push('A'));
    child.once('dispatch_evt_1', () => fired_1.push('B'));
    child.trigger('dispatch_evt_1');

    assert_eq('both once() handlers fired', fired_1, ['A', 'B']);

    // ============================================================
    // Test 2: once() + once() + on() all fire in registration order
    // ============================================================
    console.log('');
    console.log('2. once() + once() + on() MIXED:');

    const fired_2 = [];
    child.once('dispatch_evt_2', () => fired_2.push('A'));
    child.once('dispatch_evt_2', () => fired_2.push('B'));
    child.on('dispatch_evt_2', () => fired_2.push('C'));
    child.trigger('dispatch_evt_2');

    assert_eq('all three handlers fired in order', fired_2, ['A', 'B', 'C']);

    // Second trigger: once() handlers are gone, on() remains
    fired_2.length = 0;
    child.trigger('dispatch_evt_2');
    assert_eq('second trigger fires only the on() handler', fired_2, ['C']);

    // ============================================================
    // Test 3: once() registered BEFORE on() does not skip the on()
    // ============================================================
    console.log('');
    console.log('3. once() BEFORE on() DOES NOT SKIP THE on():');

    const fired_3 = [];
    child.once('dispatch_evt_3', () => fired_3.push('once'));
    child.on('dispatch_evt_3', () => fired_3.push('on'));
    child.trigger('dispatch_evt_3');

    assert_eq('on() handler fired on the same trigger', fired_3, ['once', 'on']);

    // ============================================================
    // Test 4: Many consecutive once() handlers all fire
    // ============================================================
    console.log('');
    console.log('4. FIVE CONSECUTIVE once() HANDLERS:');

    const fired_4 = [];
    for (let i = 0; i < 5; i++) {
      child.once('dispatch_evt_4', () => fired_4.push(i));
    }
    child.trigger('dispatch_evt_4');

    assert_eq('all five once() handlers fired', fired_4, [0, 1, 2, 3, 4]);

    const remaining_4 = child._lifecycle_callbacks.get('dispatch_evt_4') || [];
    assert('all five once() handlers deregistered', remaining_4.length === 0);

    // ============================================================
    // Test 5: once() handlers still fire exactly once (no double-fire)
    // ============================================================
    console.log('');
    console.log('5. once() STILL FIRES EXACTLY ONCE:');

    let count_5 = 0;
    child.once('dispatch_evt_5', () => { count_5++; });
    child.trigger('dispatch_evt_5');
    child.trigger('dispatch_evt_5');
    child.trigger('dispatch_evt_5');

    assert('once() fired exactly once across three triggers', count_5 === 1);

    // ============================================================
    // Test 6: Handler registered DURING dispatch does not fire in that dispatch
    // ============================================================
    console.log('');
    console.log('6. HANDLER REGISTERED DURING DISPATCH:');

    const fired_6 = [];
    child.on('dispatch_evt_6', () => {
      fired_6.push('outer');
      // Registering mid-dispatch: the snapshot must not include this handler.
      // Note: 'dispatch_evt_6' is already marked as occurred by trigger(), so
      // .on() is sticky and fires immediately - once, not twice.
      child.on('dispatch_evt_6', () => fired_6.push('inner'));
    });
    child.trigger('dispatch_evt_6');

    assert_eq('mid-dispatch registration fired once (sticky), not twice', fired_6, ['outer', 'inner']);

    // ============================================================
    // Test 7: Real-world - two independent await once() on same lifecycle event
    // ============================================================
    console.log('');
    console.log('7. TWO INDEPENDENT await once("ready") PROMISES:');

    const $el = $('<div>').appendTo(this.$);
    $el.component('Test_Dispatch_Child', {});
    const new_comp = $el.component();

    // Two unrelated code paths each awaiting the same lifecycle event.
    const waiter_a = new Promise(r => new_comp.once('ready', () => r('a')));
    const waiter_b = new Promise(r => new_comp.once('ready', () => r('b')));

    const timeout = new Promise(r => setTimeout(() => r('TIMEOUT'), 3000));
    const settled = await Promise.race([
      Promise.all([waiter_a, waiter_b]),
      timeout
    ]);

    assert_eq('both once("ready") promises resolved', settled, ['a', 'b']);

    // ============================================================
    // Summary
    // ============================================================
    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
