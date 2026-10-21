// Override that keeps the framework's print through super, then continues.
class Le_Super extends Jqhtml_Component {
  on_create() { this.data.value = 'initial'; }
  async on_load() { await window.le_load(this); }

  on_load_error(error) {
    super.on_load_error(error);
    window.le_record_hook('Le_Super', this, error);
    this.data.value = 'super:' + error.message;
  }
}
