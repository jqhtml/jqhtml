class Test_Boot extends Jqhtml_Component {
  async on_ready() {
    console.log('[Test_Boot] on_ready() - Starting boot tests');

    const results = [];

    // Helper to add result
    const addResult = (test, passed, message) => {
      const status = passed ? '✅' : '❌';
      results.push(`${status} ${test}: ${message}`);
      console.log(`[Test_Boot] ${status} ${test}: ${message}`);
    };

    // Helper to create placeholder HTML (simulates server output)
    const placeholder = (name, args, content = '') => {
      const argsJson = JSON.stringify(args).replace(/"/g, '&quot;');
      return `<div class="_Component_Init" data-component-init-name="${name}" data-component-args="${argsJson}">${content}</div>`;
    };

    try {
      // ═══════════════════════════════════════════════════════════════
      // Test 1: Basic boot with args
      // ═══════════════════════════════════════════════════════════════
      console.log('[Test_Boot] Running Test 1: Basic Component Boot');

      const $test1 = this.$sid('test1');
      $test1.html(placeholder('Bootable_Component', {
        message: 'Hello from server!',
        count: 42
      }));

      const initCount1Before = $test1.find('._Component_Init').length;

      await jqhtml.boot($test1);

      const initCount1After = $test1.find('._Component_Init').length;
      const bootable1 = $test1.find('.Bootable_Component').first();
      const component1 = bootable1.length ? bootable1.component() : null;

      if (initCount1Before === 1 && initCount1After === 0) {
        addResult('Test 1a', true, '_Component_Init element was processed');
      } else {
        addResult('Test 1a', false, `Expected 1->0 _Component_Init, got ${initCount1Before}->${initCount1After}`);
      }

      if (bootable1.length && bootable1.hasClass('Bootable_Component')) {
        addResult('Test 1b', true, 'Component class was added');
      } else {
        addResult('Test 1b', false, 'Component class was NOT added');
      }

      if (component1 && component1.args.message === 'Hello from server!' && component1.args.count === 42) {
        addResult('Test 1c', true, 'Args were parsed correctly');
      } else {
        addResult('Test 1c', false, `Args not parsed: ${JSON.stringify(component1?.args)}`);
      }

      // ═══════════════════════════════════════════════════════════════
      // Test 2: Nested components
      // ═══════════════════════════════════════════════════════════════
      console.log('[Test_Boot] Running Test 2: Nested Component Boot');

      const $test2 = this.$sid('test2');
      const nestedChild = placeholder('Child_Bootable', { label: 'I am the child' });
      $test2.html(placeholder('Parent_Bootable', { title: 'Parent Component' }, nestedChild));

      const initCount2Before = $test2.find('._Component_Init').length;

      await jqhtml.boot($test2);

      const initCount2After = $test2.find('._Component_Init').length;
      const parent2 = $test2.find('.Parent_Bootable').first();
      const child2 = $test2.find('.Child_Bootable').first();

      if (initCount2Before === 2 && initCount2After === 0) {
        addResult('Test 2a', true, 'Both parent and child _Component_Init processed');
      } else {
        addResult('Test 2a', false, `Expected 2->0 _Component_Init, got ${initCount2Before}->${initCount2After}`);
      }

      if (parent2.length && child2.length) {
        addResult('Test 2b', true, 'Both parent and child components created');
      } else {
        addResult('Test 2b', false, `Missing components: parent=${parent2.length}, child=${child2.length}`);
      }

      // Check that child is inside parent
      if (child2.closest('.Parent_Bootable').length > 0) {
        addResult('Test 2c', true, 'Child is nested inside parent');
      } else {
        addResult('Test 2c', false, 'Child is NOT nested inside parent');
      }

      // ═══════════════════════════════════════════════════════════════
      // Test 3: Content passing
      // ═══════════════════════════════════════════════════════════════
      console.log('[Test_Boot] Running Test 3: Content Passing');

      const $test3 = this.$sid('test3');
      const serverContent = `
        <p><strong>This content</strong> was passed from the server!</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      `;
      $test3.html(placeholder('Content_Receiver', { title: 'Card Title' }, serverContent));

      await jqhtml.boot($test3);

      const contentReceiver = $test3.find('.Content_Receiver').first();
      const contentHtml = contentReceiver.html();

      if (contentHtml.includes('This content') && contentHtml.includes('was passed from the server')) {
        addResult('Test 3a', true, 'Inner HTML content was passed to component');
      } else {
        addResult('Test 3a', false, 'Inner HTML content NOT found in component');
      }

      if (contentHtml.includes('<li>Item 1</li>')) {
        addResult('Test 3b', true, 'HTML structure preserved in content');
      } else {
        addResult('Test 3b', false, 'HTML structure NOT preserved');
      }

      // ═══════════════════════════════════════════════════════════════
      // Test 4: Await boot completion (async on_load)
      // ═══════════════════════════════════════════════════════════════
      console.log('[Test_Boot] Running Test 4: Boot Promise Resolution');

      const $test4 = this.$sid('test4');
      $test4.html(placeholder('Async_Bootable', { delay: 100 }));

      const startTime = Date.now();

      this.$sid('test4_status').text('Booting...');

      await jqhtml.boot($test4);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      this.$sid('test4_status').text(`Completed in ${elapsed}ms`);

      // The async component has a 100ms delay, so boot should take at least that long
      if (elapsed >= 90) { // Allow some tolerance
        addResult('Test 4a', true, `boot() awaited async on_load (${elapsed}ms >= 90ms)`);
      } else {
        addResult('Test 4a', false, `boot() did NOT wait for async on_load (${elapsed}ms < 90ms)`);
      }

      const asyncComponent = $test4.find('.Async_Bootable').component();
      if (asyncComponent && asyncComponent.data.loaded === true) {
        addResult('Test 4b', true, 'Async component fully loaded before boot() resolved');
      } else {
        addResult('Test 4b', false, 'Async component NOT fully loaded');
      }

      // ═══════════════════════════════════════════════════════════════
      // Test 5: jqhtml:ready event
      // ═══════════════════════════════════════════════════════════════
      console.log('[Test_Boot] Running Test 5: jqhtml:ready event');

      let eventFired = false;
      const eventHandler = () => { eventFired = true; };
      document.addEventListener('jqhtml:ready', eventHandler);

      // Create a new placeholder and boot it
      const $test5Container = $('<div>').appendTo(this.$);
      $test5Container.html(placeholder('Bootable_Component', { message: 'Event test' }));

      await jqhtml.boot($test5Container);

      document.removeEventListener('jqhtml:ready', eventHandler);

      if (eventFired) {
        addResult('Test 5', true, 'jqhtml:ready event was fired');
      } else {
        addResult('Test 5', false, 'jqhtml:ready event was NOT fired');
      }

    } catch (error) {
      console.error('[Test_Boot] Error during tests:', error);
      results.push(`❌ ERROR: ${error.message}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // Display results
    // ═══════════════════════════════════════════════════════════════
    const $results = this.$sid('results');
    $results.html(results.map(r => `<div>${r}</div>`).join(''));

    const passed = results.filter(r => r.startsWith('✅')).length;
    const failed = results.filter(r => r.startsWith('❌')).length;

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`[Test_Boot] RESULTS: ${passed} passed, ${failed} failed`);
    console.log('═══════════════════════════════════════════════════════════');

    if (failed === 0) {
      console.log('[Test_Boot] ✅ ALL TESTS PASSED');
      $results.prepend('<h3 style="color: green;">✅ ALL TESTS PASSED</h3>');
    } else {
      console.log('[Test_Boot] ❌ SOME TESTS FAILED');
      $results.prepend(`<h3 style="color: red;">❌ ${failed} TEST(S) FAILED</h3>`);
    }
  }
}
