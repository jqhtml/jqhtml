// ES6 class that we want to serialize and restore from cache
class Contact_Model {
  constructor(name, email) {
    this.name = name || '';
    this.email = email || '';
    this.created_at = new Date().toISOString();
  }

  get_display_name() {
    return `${this.name} <${this.email}>`;
  }
}

// Make globally accessible for the test
window.Contact_Model = Contact_Model;
