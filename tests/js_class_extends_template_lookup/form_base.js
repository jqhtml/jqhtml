/**
 * Form_Base - Base class WITH template
 *
 * This class has both logic AND a template.
 * Child classes can extend this without defining their own templates.
 */
class Form_Base extends Jqhtml_Component {
  on_create() {
    console.log('[Form_Base] on_create: Initializing form base');
    // Field values are read out of the DOM in on_ready(), where this.data is frozen -
    // and the freeze is DEEP, so this.data.fields.x = ... throws. Form field state is
    // UI state, so it lives in this.state.
    this.state.fields = {};
  }

  async on_ready() {
    console.log('[Form_Base] on_ready: Form base ready');
  }

  // Base class methods
  get_data() {
    return this.state.fields;
  }

  validate() {
    console.log('[Form_Base] validate() called');
    return Object.keys(this.state.fields).length > 0;
  }
}

// Make globally available for child classes
window.Form_Base = Form_Base;
