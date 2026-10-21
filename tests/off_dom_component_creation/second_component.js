class Second_Component extends Jqhtml_Component {
  async on_ready() {
    console.log('[Second_Component] on_ready: Modifying child text via $sid()...');
    (window.__off_dom_log = window.__off_dom_log || []).push('Second_Component.on_ready');

    // Use sid()/$sid() to find the deeply nested child component and modify its text.
    // This tests that both work off-DOM using the find() fallback.
    const child = this.sid('child');
    const $deepChild = child ? child.$sid('deep_child') : $();
    window.__off_dom_seen = {
      connected: this.$[0].isConnected,
      child_is_third_level: !!child && child.component_name() === 'Third_Level_Child',
      deep_child_found: $deepChild.length === 1 && $deepChild.hasClass('Fourth_Level_Child')
    };
    if (child) {
      $deepChild.text('Modified by Second_Component');
      console.log('[Second_Component] Successfully modified Fourth_Level_Child text via $sid()');
    } else {
      console.error('[Second_Component] ERROR: Could not find child component via sid()');
    }
  }
}
