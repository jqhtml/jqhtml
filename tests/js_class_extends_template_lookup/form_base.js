/**
 * Form_Base - Base class WITH template
 *
 * This class has both logic AND a template.
 * Child classes can extend this without defining their own templates.
 */
class Form_Base extends Jqhtml_Component {
  on_create() {
    console.log('[Form_Base] on_create: Initializing form base');
    this.data.fields = {};
  }

  async on_ready() {
    console.log('[Form_Base] on_ready: Form base ready');
  }

  // Base class methods
  get_data() {
    return this.data.fields;
  }

  validate() {
    console.log('[Form_Base] validate() called');
    return Object.keys(this.data.fields).length > 0;
  }
}

// Make globally available for child classes
window.Form_Base = Form_Base;
