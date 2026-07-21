class Test_Page extends Jqhtml_Component {
  on_ready() {
    console.log('=== on_load() Restrictions Test ===');

    const test_component = this.$.find('.Test_Component').component();
    console.log('Test result:', test_component.data.test_passed || test_component.data.test_failed);

    if (test_component.data.test_passed) {
      console.log('✅ TEST PASSED: on_load() restrictions working correctly');
    } else {
      console.log('❌ TEST FAILED:', test_component.data.test_failed);
    }
  }
}
