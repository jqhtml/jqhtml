class Parent_Component extends Jqhtml_Component {
  on_create() {
    console.log('[PARENT] on_create() called');
  }

  async on_ready() {
    console.log('[PARENT] on_ready() called');

    // Get reference to child component
    const child = this.sid('child');
    console.log('[PARENT] Got child component:', child);

    this.$sid('status').text('Initial load complete. Waiting 500ms...');

    // Wait 500ms
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('');
    console.log('='.repeat(60));
    console.log('[PARENT] 500ms elapsed. Modifying child args and calling reload()');
    console.log('='.repeat(60));
    console.log('');

    // Modify child's args
    console.log('[PARENT] Before modification, child.args:', JSON.stringify(child.args));
    child.args.filter = 'modified_by_parent';
    console.log('[PARENT] After modification, child.args:', JSON.stringify(child.args));

    this.$sid('status').text('Modified child args. Calling reload()...');

    // Call reload on child
    console.log('[PARENT] Calling child.reload()...');
    await child.reload();
    console.log('[PARENT] child.reload() completed');

    this.$sid('status').text('Reload complete!');
  }
}
