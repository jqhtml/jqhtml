class Reload_Ready_Invalidation_Test extends Jqhtml_Component {
  async on_ready() {
    // Wait for the test container to complete its tests
    await this.sid('test_container').ready();
  }
}
