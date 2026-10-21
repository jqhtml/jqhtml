// No on_load_error() override: a failed load behaves as it always has.
class Le_Plain extends Jqhtml_Component {
  on_create() { this.data.value = 'initial'; }
  async on_load() { await window.le_load(this); }
}
