class Test_Loaded_Event_And_Once extends Jqhtml_Component {
  on_create() {
    this.state.test_results = [];
  }

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    const results = this.state.test_results;
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

    // ============================================================
    // Test 1: .on('loaded') fires on a child component
    // ============================================================
    console.log('');
    console.log('1. ON("LOADED") EVENT FIRES:');

    const child = this.sid('child');
    let on_loaded_fired = false;
    let on_loaded_data = null;

    // Event should have already occurred (child is ready), so .on() fires immediately (sticky)
    child.on('loaded', (comp, data) => {
      on_loaded_fired = true;
      on_loaded_data = comp;
    });

    assert('.on("loaded") fired immediately (sticky)', on_loaded_fired);
    assert('.on("loaded") received component reference', on_loaded_data === child);

    // ============================================================
    // Test 2: .once('loaded') fires immediately if already occurred
    // ============================================================
    console.log('');
    console.log('2. ONCE("LOADED") FIRES IMMEDIATELY (STICKY):');

    let once_loaded_fired = false;
    let once_loaded_comp = null;

    child.once('loaded', (comp, data) => {
      once_loaded_fired = true;
      once_loaded_comp = comp;
    });

    assert('.once("loaded") fired immediately (already occurred)', once_loaded_fired);
    assert('.once("loaded") received component reference', once_loaded_comp === child);

    // ============================================================
    // Test 3: .once('loaded') does NOT register after immediate fire
    // ============================================================
    console.log('');
    console.log('3. ONCE("LOADED") DOES NOT REGISTER AFTER IMMEDIATE FIRE:');

    // Get the callback count for 'loaded' event before and after .once()
    const callbacks_before = (child._lifecycle_callbacks.get('loaded') || []).length;

    let once_extra_count = 0;
    child.once('loaded', () => { once_extra_count++; });

    const callbacks_after = (child._lifecycle_callbacks.get('loaded') || []).length;

    assert('.once() did not add callback (already fired)', callbacks_before === callbacks_after);
    assert('.once() callback fired exactly once', once_extra_count === 1);

    // ============================================================
    // Test 4: .once('ready') fires immediately too (verify pattern works for other events)
    // ============================================================
    console.log('');
    console.log('4. ONCE("READY") FIRES IMMEDIATELY (STICKY):');

    let once_ready_fired = false;
    child.once('ready', (comp) => {
      once_ready_fired = true;
    });

    assert('.once("ready") fired immediately', once_ready_fired);

    // ============================================================
    // Test 5: .once() for future event (not yet occurred)
    // ============================================================
    console.log('');
    console.log('5. ONCE() FOR FUTURE EVENT (NOT YET OCCURRED):');

    let custom_once_count = 0;
    child.once('custom_test_event', () => {
      custom_once_count++;
    });

    // Verify callback is registered
    const custom_callbacks = child._lifecycle_callbacks.get('custom_test_event') || [];
    assert('.once() registered callback for future event', custom_callbacks.length === 1);

    // Trigger the event twice
    child.trigger('custom_test_event');
    child.trigger('custom_test_event');

    assert('.once() callback fired exactly once after two triggers', custom_once_count === 1);

    // Verify callback was deregistered
    const custom_callbacks_after = child._lifecycle_callbacks.get('custom_test_event') || [];
    assert('.once() callback deregistered after firing', custom_callbacks_after.length === 0);

    // ============================================================
    // Test 6: .on('loaded') fires again on reload()
    // ============================================================
    console.log('');
    console.log('6. ON("LOADED") FIRES AGAIN ON RELOAD:');

    let reload_loaded_count = 0;
    child.on('loaded', () => {
      reload_loaded_count++;
    });

    // .on() is sticky so it fires immediately once (already occurred)
    const initial_count = reload_loaded_count;
    assert('.on("loaded") fired immediately on registration (sticky)', initial_count === 1);

    await child.reload();

    assert('.on("loaded") fired again after reload()', reload_loaded_count === initial_count + 1);

    // ============================================================
    // Test 7: .once() on programmatically created component (before event)
    // ============================================================
    console.log('');
    console.log('7. ONCE() ON NEW COMPONENT (BEFORE LOADED):');

    let new_comp_once_loaded = false;
    let new_comp_once_ready = false;

    const $el = $('<div>').appendTo(this.$);
    $el.component('Test_Child', {});
    const new_comp = $el.component();

    new_comp.once('loaded', () => {
      new_comp_once_loaded = true;
    });

    new_comp.once('ready', () => {
      new_comp_once_ready = true;
    });

    // Wait for events to fire (child has 200ms on_load delay + lifecycle)
    await new Promise(r => setTimeout(r, 1500));

    assert('.once("loaded") fired on new component', new_comp_once_loaded);
    assert('.once("ready") fired on new component', new_comp_once_ready);

    // Verify they don't fire again on reload
    new_comp_once_loaded = false;
    new_comp_once_ready = false;
    await new Promise((resolve) => {
      new_comp.on('ready', () => resolve());
      new_comp.reload();
    });

    assert('.once("loaded") did NOT fire again after reload', !new_comp_once_loaded);
    assert('.once("ready") did NOT fire again after reload', !new_comp_once_ready);

    // ============================================================
    // Test 8: .once() chaining (returns component)
    // ============================================================
    console.log('');
    console.log('8. ONCE() RETURNS COMPONENT FOR CHAINING:');

    const chain_result = child.once('some_future_event', () => {});
    assert('.once() returns component instance', chain_result === child);

    const on_result = child.on('some_future_event2', () => {});
    assert('.on() returns component instance', on_result === child);

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
