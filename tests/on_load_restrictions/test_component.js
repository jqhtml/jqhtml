class Test_Component extends Jqhtml_Component {
  async on_load() {
    // Valid: accessing this.args and this.data
    const user_id = this.args.user_id;

    // Valid: setting this.data
    this.data = {
      user_id: user_id,
      loaded: true
    };

    // Test restriction: try to access component_name() (should throw)
    try {
      const name = this.component_name();
      this.data.test_failed = 'Should not be able to access this.component_name()';
    } catch (error) {
      this.data.test_passed = 'Correctly blocked this.component_name() access';
    }
  }
}
