class Bootable_Component extends Jqhtml_Component {
  on_create() {
    console.log('[Bootable_Component] on_create() - args:', this.args);
  }

  on_ready() {
    console.log('[Bootable_Component] on_ready() - Component is ready');
    console.log('[Bootable_Component] message:', this.args.message);
    console.log('[Bootable_Component] count:', this.args.count);
  }
}
