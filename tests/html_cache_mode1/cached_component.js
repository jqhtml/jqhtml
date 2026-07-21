class Cached_Component extends Jqhtml_Component {
  on_create() {
    this.data.loading = true;
    this.data.title = '';
    this.data.content = '';
    this.data.loaded_at = '';
  }

  async on_load() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate loaded data
    this.data.loading = false;
    this.data.title = 'Loaded Title';
    this.data.content = 'This content was loaded from the API.';
    this.data.loaded_at = new Date().toISOString();
  }
}
