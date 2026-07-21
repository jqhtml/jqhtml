class Component_With_Defaults extends Jqhtml_Component {
  on_ready() {
    console.log('[Component_With_Defaults] on_ready() called');
    console.log('  this.args.per_page:', this.args.per_page, '(type:', typeof this.args.per_page + ')');
    console.log('  this.args.sortable:', this.args.sortable, '(type:', typeof this.args.sortable + ')');
    console.log('  this.args.endpoint:', this.args.endpoint, '(type:', typeof this.args.endpoint + ')');
    console.log('  this.args.theme:', this.args.theme, '(type:', typeof this.args.theme + ')');
  }
}
