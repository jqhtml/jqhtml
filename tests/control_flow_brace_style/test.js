class Control_Flow_Test extends Jqhtml_Component {
  on_create() {
    // Set up test data
    this.data.show_message = true;
    this.data.is_admin = false;
    this.data.items = [
      { name: 'Apple' },
      { name: 'Banana' },
      { name: 'Cherry' }
    ];
  }

  on_ready() {
    console.log('✅ Control Flow Test component ready!');
    console.log('Test data:', {
      show_message: this.data.show_message,
      is_admin: this.data.is_admin,
      items: this.data.items
    });
  }
}
