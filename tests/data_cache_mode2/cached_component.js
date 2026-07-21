class Cached_Component extends Jqhtml_Component {
  on_create() {
    this.data.loading = true;
    this.data.contact = null;
    this.data.loaded_at = '';
  }

  async on_load() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate loaded data using ES6 class
    this.data.loading = false;
    this.data.contact = new window.Contact_Model('John Doe', 'john@example.com');
    this.data.loaded_at = new Date().toISOString();
  }
}
