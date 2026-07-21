/**
 * ES6 Class that is deliberately NOT registered with jqhtml.register_cache_class()
 *
 * This class will be returned from on_load() and should be normalized to a plain
 * object due to hot/cold cache parity normalization.
 */
class Unregistered_Model {
  constructor(name, email) {
    this.name = name;
    this.email = email;
    this.created_at = new Date().toISOString();
  }

  /**
   * This method should NOT be available after normalization
   */
  get_display_name() {
    return `${this.name} <${this.email}>`;
  }

  /**
   * This method should NOT be available after normalization
   */
  validate_email() {
    return this.email.includes('@');
  }
}

// Export to global scope for test access
window.Unregistered_Model = Unregistered_Model;
