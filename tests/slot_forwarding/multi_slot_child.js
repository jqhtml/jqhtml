class Multi_Slot_Child extends Jqhtml_Component {
  on_create() {
    // Initialize with empty data to prevent first render errors
    this.data = {
      header: { title: '' },
      rows: [],
      footer: { text: '' }
    };
  }

  async on_load() {
    console.log('[Multi_Slot_Child] Loading test data with multiple sections...');

    this.data = {
      header: {
        title: 'Test Report Header'
      },
      rows: [
        { name: 'Item Alpha' },
        { name: 'Item Beta' },
        { name: 'Item Gamma' }
      ],
      footer: {
        text: 'End of Report - 3 items total'
      }
    };

    console.log('[Multi_Slot_Child] Data loaded:', this.data);
  }
}
