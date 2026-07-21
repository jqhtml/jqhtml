class Second_Component extends Jqhtml_Component {
  async on_ready() {
    console.log('[Second_Component] on_ready: Modifying child text via $id()...');

    // Use $id() to find deeply nested child component and modify its text
    // This tests that $id() works off-DOM using find() fallback
    const child = this.sid('child');
    if (child) {
      const $deepChild = child.$sid('deep_child');
      $deepChild.text('Modified by Second_Component');
      console.log('[Second_Component] Successfully modified Fourth_Level_Child text via $id()');
    } else {
      console.error('[Second_Component] ERROR: Could not find child component via id()');
    }
  }
}
