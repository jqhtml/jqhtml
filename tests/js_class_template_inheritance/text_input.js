class Text_Input extends Jqhtml_Component {
  async on_ready() {
    console.log('[Text_Input] on_ready: Base text input initialized');
  }

  /**
   * Get the current value of the input
   * @returns {string}
   */
  get_value() {
    return this.$sid('input').val();
  }

  /**
   * Set the value of the input
   * @param {string} value
   */
  set_value(value) {
    this.$sid('input').val(value);
  }
}

// Make Text_Input available globally so child classes can extend it
window.Text_Input = Text_Input;
