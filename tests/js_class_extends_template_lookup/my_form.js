/**
 * My_Form - Extends Form_Base but has NO template
 *
 * Should use Form_Base's template when instantiated.
 */
class My_Form extends Form_Base {
  async on_ready() {
    await super.on_ready();
    console.log('[My_Form] on_ready: My form ready');

    // Populate form data
    this.data.fields.sample = this.$sid('field').val();
  }

  // Child class adds functionality
  format_output() {
    const data = this.get_data();
    return JSON.stringify(data, null, 2);
  }
}

// Make globally available
window.My_Form = My_Form;
