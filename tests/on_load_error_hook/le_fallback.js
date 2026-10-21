// Synchronous override: records the call, probes the restricted context, sets fallback data.
class Le_Fallback extends Jqhtml_Component {
  on_create() { this.data.value = 'initial'; }
  async on_load() { await window.le_load(this); }

  on_load_error(error) {
    window.le_record_hook('Le_Fallback', this, error);
    // Same access as on_load(): this.args readable, this.data writable, nothing else.
    try {
      this.$;
      this.data.dollar = 'allowed';
    } catch (e) {
      this.data.dollar = e.message;
    }
    this.data.arg_key = this.args.key;
    this.data.value = 'fallback:' + error.message;
  }
}
