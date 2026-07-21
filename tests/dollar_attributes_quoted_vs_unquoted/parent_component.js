class Parent_Component extends Jqhtml_Component {
  on_create() {
    this.data.test_object = {name: 'Test Object', value: 42};
    this.data.test_array = [1, 2, 3, 4, 5];
  }

  parent_callback(message) {
    console.log(`Parent callback invoked with: "${message}"`);
    return 'callback_result';
  }
}
