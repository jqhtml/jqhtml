class DataGrid_Abstract extends Jqhtml_Component {
  // Initialize data structure before first render
  on_create() {
    console.log('[DataGrid_Abstract] on_create: Initializing data structure');

    // Initialize data state immediately so template can render
    this.data.rows = [];
    this.data.loading = true;
    this.data.loaded = false;
  }

  // Simulate async data loading
  async on_load() {
    console.log('[DataGrid_Abstract] on_load: Simulating async data fetch...');

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));

    // Simulate fetched data
    this.data.rows = [
      { id: 1, name: 'John Doe', email: 'john@example.com', phone: '555-0101' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', phone: '555-0102' },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com', phone: '555-0103' }
    ];
    this.data.loading = false;
    this.data.loaded = true;

    console.log('[DataGrid_Abstract] on_load: Data loaded successfully', this.data.rows.length, 'rows');
  }

  // Component ready
  async on_ready() {
    console.log('[DataGrid_Abstract] on_ready: Component fully initialized');
  }

  // Public method that child components can call
  get_row_count() {
    return this.data.rows ? this.data.rows.length : 0;
  }
}

// Make DataGrid_Abstract available globally so child classes can extend it
window.DataGrid_Abstract = DataGrid_Abstract;
