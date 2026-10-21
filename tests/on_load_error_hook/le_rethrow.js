// Override that rethrows: takes the stop path.
class Le_Rethrow extends Jqhtml_Component {
  on_create() { this.data.value = 'initial'; }
  async on_load() { await window.le_load(this); }

  on_load_error(error) {
    window.le_record_hook('Le_Rethrow', this, error);
    throw error;
  }
}
