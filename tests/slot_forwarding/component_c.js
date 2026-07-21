class Component_C extends Jqhtml_Component {
  on_create() {
    // Initialize with empty array to prevent first render errors
    this.data = {
      rows: []
    };
  }

  async on_load() {
    console.log('[Component_C] Loading test data...');

    // Simulate fetching data
    this.data = {
      rows: [
        { id: 1, name: 'First Row' },
        { id: 2, name: 'Second Row' },
        { id: 3, name: 'Third Row' }
      ]
    };

    console.log('[Component_C] Data loaded:', this.data);
  }
}
