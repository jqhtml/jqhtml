class Parent_A extends Jqhtml_Component {
  on_render() {
    console.log('[Parent_A] on_render - setting up setTimeout to reload child in 50ms');

    // Simulate user action that triggers child reload while child is still in its initial on_load
    // Using setTimeout because on_render is synchronous
    const that = this;
    setTimeout(function() {
      console.log('[Parent_A] setTimeout fired - calling reload() on child');
      try {
        const child = that.sid('child_component');
        if (child) {
          child.reload();
          console.log('[Parent_A] reload() call completed without error');
        } else {
          console.log('[Parent_A] child not found yet');
        }
      } catch (e) {
        console.error('[Parent_A] Error calling reload():', e.message);
        window.__test_error = e.message;
      }
    }, 50);
  }

  on_ready() {
    console.log('[Parent_A] on_ready');
  }
}
