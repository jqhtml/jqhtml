// Async override: the lifecycle waits for it.
class Le_Async extends Jqhtml_Component {
  on_create() { this.data.value = 'initial'; }
  async on_load() { await window.le_load(this); }

  async on_load_error(error) {
    await new Promise((resolve) => setTimeout(resolve, 30));
    window.le_record_hook('Le_Async', this, error);
    this.data.value = 'async:' + error.message;
  }
}
