class Test_Component extends Jqhtml_Component {
  on_create() {
    this.data.contact = null;
  }

  async on_load() {
    // Simulate async data load
    await new Promise(resolve => setTimeout(resolve, 20));

    // Return an ES6 class instance that is NOT registered
    // Due to hot/cold cache parity, this will be normalized to a plain object
    this.data.contact = new window.Unregistered_Model('John Doe', 'john@example.com');
  }
}
