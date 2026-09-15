class Snap_List extends Jqhtml_Component {
  on_create() {
    this.data.items = [];
  }

  async on_load() {
    await new Promise((resolve) => setTimeout(resolve, 10));
    this.data.items.push('a');
  }
}
