class Caching_Test extends Jqhtml_Component {
  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    const assert = (name, condition) => {
      if (condition) { console.log('   PASS: ' + name); passed++; }
      else { console.log('   FAIL: ' + name); failed++; }
    };
    const mode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';
    const uc = window.__uc;
    const loads_of = (id) => uc.loads.filter((v) => v === id).length;

    const first = this.$.find('.User_Card').first().component();
    await first.ready();

    console.log('');
    console.log('1. COLD LOAD POPULATES AND RENDERS:');
    assert('on_load() ran once for user 123', loads_of(123) === 1);
    assert('this.data came from on_load()', first.data.name === 'User 123');
    assert('DOM shows the loaded user', first.$.text().includes('User 123'));
    assert('the FIRST paint was the empty/loading state', uc.first_render[0].loaded === false);

    console.log('');
    console.log('2. A SECOND INSTANCE WITH THE SAME ARGS AGREES:');
    // Mount into the document first: a DETACHED element defers its first paint until
    // after on_load(), which would hide the very difference this test is about.
    const second = $('<div />').appendTo('#test2-container')
      .component('User_Card', { user_id: 123 }).component();
    await second.ready();
    assert('it rendered the same user', second.$.text().includes('User 123'));
    assert('its data matches the first', second.data.email === first.data.email);
    assert('it is a separate data object', second.data !== first.data);
    assert('on_load() revalidated (ran again for 123)', loads_of(123) === 2);

    console.log('');
    console.log(`3. WARM-CACHE FIRST PAINT (mode: ${mode}):`);
    const second_first_paint = uc.first_render.find((r, i) => i > 0 && r.user_id === 123);
    if (mode === 'data') {
      assert('data mode painted the cached data immediately', second_first_paint.loaded === true);
    } else {
      assert('without a data cache the first paint is still empty', second_first_paint.loaded === false);
    }

    console.log('');
    console.log('4. DIFFERENT ARGS ARE A DIFFERENT ENTRY:');
    const third = $('<div />').appendTo('#test3-container')
      .component('User_Card', { user_id: 456 }).component();
    await third.ready();
    assert('on_load() ran for user 456', loads_of(456) === 1);
    assert('it rendered its own user', third.data.name === 'User 456');
    assert('its first paint was empty (cache miss)', uc.first_render.find((r) => r.user_id === 456).loaded === false);
    assert('the first card is untouched', first.data.name === 'User 123');

    console.log('first_render tally:', JSON.stringify(uc.first_render));
    console.log('loads tally:', JSON.stringify(uc.loads));

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
