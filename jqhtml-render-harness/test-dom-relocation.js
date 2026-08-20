/**
 * Test: DOM Relocation During Async Load
 *
 * Tests that a component can be moved in the DOM during its async on_load()
 * phase without interrupting its lifecycle.
 *
 * Timeline:
 * - 0ms: Component auto-created in #app by test runner
 * - 500ms: DOM element relocated from #app to #target-container
 * - 1000ms: on_load() completes, component re-renders with loaded data
 * - After re-render: on_ready() fires
 */

class Test_Dom_Relocation extends Jqhtml_Component {
  on_create() {
    // Initialize data before first render (like Client_Label does)
    this.data.loaded = false;
    this.data.message = '';
    this.data.ready_fired = false;
  }

  async on_load() {
    console.log('[0ms] Component on_load() started');

    // Simulate 1 second async data fetch
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('[1000ms] Component on_load() completed - setting data');
    this.data.loaded = true;
    this.data.message = 'Successfully loaded after DOM relocation!';
  }

  on_ready() {
    console.log('[After load] Component on_ready() fired!');
    console.log('[on_ready] Current data:', JSON.stringify(this.data));
    this.data.ready_fired = true;
  }
}

// Set up test environment after component is rendered
// Note: Test runner auto-renders component to #app, so we wait for it
setTimeout(() => {
  console.log('=== DOM Relocation Test Started ===');

  // Create target container next to the auto-rendered component
  const $component = $('.Test_Dom_Relocation');

  if ($component.length === 0) {
    console.error('Component not found! Test setup failed.');
    return;
  }

  // Wrap the existing app in a source container and add target container
  $('#app').wrap('<div id="source-container" style="border: 2px solid red; padding: 10px; margin: 10px;"></div>');
  $('#source-container').before('<h3>Source Container (initial location)</h3>');
  $('body').append(`
    <div id="target-container" style="border: 2px solid green; padding: 10px; margin: 10px;">
      <h3>Target Container (relocated to here at 500ms)</h3>
    </div>
  `);

  console.log('[0ms] Test environment set up, component is in #source-container');

  // At 500ms, relocate the component to target container
  setTimeout(() => {
    console.log('[500ms] Relocating component from source to target container');
    const $comp = $('.Test_Dom_Relocation');

    if ($comp.length) {
      console.log('[500ms] Component found, moving to #target-container');
      $('#target-container').append($comp);
      console.log('[500ms] Component relocated successfully');
    } else {
      console.error('[500ms] Component not found!');
    }
  }, 500);

  // At 2000ms, check final state
  setTimeout(() => {
    console.log('[2000ms] === Final State Check ===');
    const $comp = $('.Test_Dom_Relocation');
    const component = $comp.component();

    if (component) {
      console.log('[2000ms] Component exists:', {
        loaded: component.data.loaded,
        message: component.data.message,
        ready_fired: component.data.ready_fired,
        location: $comp.parent().attr('id')
      });

      const parentId = $comp.parent().attr('id');
      const inTargetContainer = parentId === 'target-container';

      if (component.data.loaded && component.data.ready_fired && inTargetContainer) {
        console.log('[2000ms] ✓ TEST PASSED: Component completed lifecycle AND was successfully relocated');
      } else {
        console.error('[2000ms] ✗ TEST FAILED: Component did not complete lifecycle or relocation failed');
        console.error('[2000ms] Expected: loaded=true, ready_fired=true, location=target-container');
        console.error('[2000ms] Actual:', {
          loaded: component.data.loaded,
          ready_fired: component.data.ready_fired,
          location: parentId
        });
      }
    } else {
      console.error('[2000ms] ✗ TEST FAILED: Component not found');
    }
  }, 2000);
}, 100); // Small delay to ensure auto-render completes
