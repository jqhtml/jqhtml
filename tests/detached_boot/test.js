class Test_Detached_Boot extends Jqhtml_Component {
  on_create() {
    // Initialize render tracking
    window.__render_log = [];
  }

  async on_ready() {
    let passed = 0;
    let failed = 0;

    function check(num, label, condition) {
      console.log('');
      console.log(num + '. ' + label + ':');
      if (condition) {
        console.log('   PASS');
        passed++;
      } else {
        console.log('   FAIL');
        failed++;
      }
    }

    function count(name) {
      return window.__render_log.filter(n => n === name).length;
    }

    // Helper: get text content from component's inner div
    function content_text($el) {
      return $el.children().first().text();
    }

    // Reset render log before detached tests
    window.__render_log = [];

    // ========================================
    // GROUP 1: Detached components — async ones skip initial render
    // ========================================

    // Create all detached
    const $static        = $('<div>').component('Static_Component', {});
    const $loading        = $('<div>').component('Loading_Component', {});
    const $slow_noop      = $('<div>').component('Slow_Noop_Component', {});
    const $static_def     = $('<div>').component('Static_Defaults', {});
    const $loading_def    = $('<div>').component('Loading_Defaults', {});
    const $slow_noop_def  = $('<div>').component('Slow_Noop_Defaults', {});

    // Synchronous check — async components (with on_load) should NOT have rendered yet
    // Static components (no on_load) complete synchronously so they render immediately
    const async_renders = window.__render_log.filter(n =>
      n === 'Loading_Component' || n === 'Slow_Noop_Component' ||
      n === 'Loading_Defaults' || n === 'Slow_Noop_Defaults'
    ).length;
    check(1, 'ASYNC COMPONENTS: no render before on_load completes (sync check)',
      async_renders === 0);

    // Wait for all to complete
    await Promise.all([
      $static.component().ready(),
      $loading.component().ready(),
      $slow_noop.component().ready(),
      $static_def.component().ready(),
      $loading_def.component().ready(),
      $slow_noop_def.component().ready(),
    ]);

    // Allow a tick for stragglers
    await new Promise(r => setTimeout(r, 50));

    // ========================================
    // GROUP 2: Each component renders exactly once
    // (Loading types would normally render TWICE — once empty, once with data.
    //  Detached optimization means only ONE render with the final data.)
    // ========================================

    check(2, 'STATIC renders once',
      count('Static_Component') === 1);

    check(3, 'LOADING renders once (not twice like normal)',
      count('Loading_Component') === 1);

    check(4, 'SLOW NOOP renders once (on_load didn\'t change data, but detached forces render)',
      count('Slow_Noop_Component') === 1);

    check(5, 'STATIC WITH DEFAULTS renders once',
      count('Static_Defaults') === 1);

    check(6, 'LOADING WITH DEFAULTS renders once',
      count('Loading_Defaults') === 1);

    check(7, 'SLOW NOOP WITH DEFAULTS renders once',
      count('Slow_Noop_Defaults') === 1);

    // ========================================
    // GROUP 3: Content correctness
    // ========================================

    check(8, 'STATIC shows static content',
      content_text($static) === 'static content');

    check(9, 'LOADING shows loaded data (not empty)',
      content_text($loading) === 'loaded');

    check(10, 'SLOW NOOP shows template default',
      content_text($slow_noop) === 'slow noop content');

    check(11, 'STATIC DEFAULTS shows on_create data',
      content_text($static_def) === 'default');

    check(12, 'LOADING DEFAULTS shows loaded data (not on_create default)',
      content_text($loading_def) === 'loaded');

    check(13, 'SLOW NOOP DEFAULTS shows on_create data (on_load didn\'t change it)',
      content_text($slow_noop_def) === 'default');

    // ========================================
    // GROUP 4: Append mid-load — component still renders correctly
    // ========================================

    window.__render_log = [];

    // Create detached loading component (on_load takes 300ms)
    const $mid_loading = $('<div>').component('Loading_Defaults', {});

    // Append to DOM after 100ms (while on_load is still running)
    setTimeout(() => {
      $mid_loading.appendTo(this.$sid('results'));
    }, 100);

    await $mid_loading.component().ready();

    check(14, 'MID-LOAD APPEND: renders once',
      count('Loading_Defaults') === 1);

    check(15, 'MID-LOAD APPEND: element is in DOM',
      $mid_loading[0].isConnected === true);

    check(16, 'MID-LOAD APPEND: shows loaded data',
      content_text($mid_loading) === 'loaded');

    // Same test with slow_noop_defaults (on_load takes 500ms, doesn't change data)
    window.__render_log = [];

    const $mid_noop = $('<div>').component('Slow_Noop_Defaults', {});

    setTimeout(() => {
      $mid_noop.appendTo(this.$sid('results'));
    }, 200);

    await $mid_noop.component().ready();

    check(17, 'MID-LOAD NOOP APPEND: renders once',
      count('Slow_Noop_Defaults') === 1);

    check(18, 'MID-LOAD NOOP APPEND: element is in DOM',
      $mid_noop[0].isConnected === true);

    check(19, 'MID-LOAD NOOP APPEND: shows on_create default data',
      content_text($mid_noop) === 'default');

    // ========================================
    // GROUP 5: _force_initial_render overrides detached optimization
    // ========================================

    window.__render_log = [];

    // Create detached but with _force_initial_render — should render TWICE (like normal)
    const $forced = $('<div>').component('Loading_Defaults', { _force_initial_render: true });

    // Synchronous check — forced component SHOULD have rendered once already (initial render)
    const forced_sync_renders = count('Loading_Defaults');
    check(20, 'FORCE INITIAL RENDER: renders synchronously (initial render not skipped)',
      forced_sync_renders === 1);

    // First render should show on_create default (not loaded data yet)
    check(21, 'FORCE INITIAL RENDER: initial render shows on_create default',
      content_text($forced) === 'default');

    await $forced.component().ready();
    await new Promise(r => setTimeout(r, 50));

    // After ready, should have rendered twice (initial + after on_load)
    check(22, 'FORCE INITIAL RENDER: renders twice total (initial + after load)',
      count('Loading_Defaults') === 2);

    // Final content should be loaded data
    check(23, 'FORCE INITIAL RENDER: final content shows loaded data',
      content_text($forced) === 'loaded');

    // ========================================
    // SUMMARY
    // ========================================

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
