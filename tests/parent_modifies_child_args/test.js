class Test_Page extends Jqhtml_Component {
  on_ready() {
    console.log('=== Test Page Ready ===');
    console.log('Watch for [CHILD] on_load() messages in console');
    console.log('Should see TWO on_load() calls:');
    console.log('  1. Initial with filter="initial"');
    console.log('  2. After 500ms with filter="modified_by_parent"');
    console.log('');
  }
}
