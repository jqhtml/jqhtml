class Reload_Test extends Jqhtml_Component {
  on_ready() {
    console.log('[Reload_Test] Setting up test buttons');

    // Test 1: Basic reload with same args
    const test1_component = $('<div />').component('Data_Component', {data_id: 100}).appendTo('#test1-container').component();
    $('#test1-reload').on('click', async () => {
      console.log('\n[Test 1] Reloading with same args...');
      await test1_component.reload();
      console.log('[Test 1] Reload complete');
    });

    // Test 2: Reload with args change (cache should exist from Test 1)
    const test2_component = $('<div />').component('Data_Component', {data_id: 100}).appendTo('#test2-container').component();
    $('#test2-change-args').on('click', async () => {
      console.log('\n[Test 2] Changing args to 200 and reloading (should hit cache from previous load)...');
      // Simulate changing args (in real app, this would be done differently)
      test2_component.args.data_id = 200;
      await test2_component.reload();
      console.log('[Test 2] Reload complete with changed args');
    });

    // Test 3: Reload with args change to uncached value
    const test3_component = $('<div />').component('Data_Component', {data_id: 300}).appendTo('#test3-container').component();
    $('#test3-change-args').on('click', async () => {
      console.log('\n[Test 3] Changing args to 999 and reloading (cache miss - fresh load)...');
      test3_component.args.data_id = 999;
      await test3_component.reload();
      console.log('[Test 3] Reload complete with uncached args');
    });

    // Pre-load some data into cache by creating a component with data_id: 200
    console.log('[Reload_Test] Pre-loading data_id=200 into cache...');
    setTimeout(() => {
      $('<div />').component('Data_Component', {data_id: 200}).appendTo('body').component();
    }, 500);

    // Auto-trigger tests after delays
    setTimeout(async () => {
      console.log('\n=== AUTO-TRIGGERING TEST 1 ===');
      await test1_component.reload();
      console.log('[Test 1] Auto-reload complete');
    }, 1500);

    setTimeout(async () => {
      console.log('\n=== AUTO-TRIGGERING TEST 2 ===');
      test2_component.args.data_id = 200;
      await test2_component.reload();
      console.log('[Test 2] Auto-reload complete with changed args');
    }, 2500);

    setTimeout(async () => {
      console.log('\n=== AUTO-TRIGGERING TEST 3 ===');
      test3_component.args.data_id = 999;
      await test3_component.reload();
      console.log('[Test 3] Auto-reload complete with uncached args');
    }, 3500);
  }
}
