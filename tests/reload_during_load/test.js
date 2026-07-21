class Test extends Jqhtml_Component {
  async on_ready() {
    const parent = this.sid('parent');

    // Wait for parent to be fully ready (which means child should have gone through the reload attempt)
    await parent.ready();

    // Give a bit more time for any queued reloads to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check if test passed
    if (window.__test_error) {
      console.log('[TEST] FAILED:', window.__test_error);
      window.testPassed = false;
    } else {
      console.log('[TEST] PASSED: reload() during on_load() handled correctly');
      console.log('[TEST] Child load count:', window.__child_load_count || 0);
      window.testPassed = true;
    }
  }
}
