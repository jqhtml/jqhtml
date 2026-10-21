/**
 * args_simple_test - a quoted $ attribute reaches the child's this.args, on_load() copies
 * it into this.data, and the template renders it.
 */
class Test_Args_Simple extends Jqhtml_Component {
  async on_ready() {
    let passed = 0;
    let failed = 0;
    const assert = (name, condition, detail) => {
      if (condition) {
        console.log('   PASS: ' + name);
        passed++;
      } else {
        console.log('   FAIL: ' + name + (detail !== undefined ? ' - got ' + JSON.stringify(detail) : ''));
        failed++;
      }
    };

    const simple = this.sid('simple');
    assert('child component found by $sid', !!simple);
    if (simple) {
      assert('this.args.myval is the string "hello"', simple.args.myval === 'hello', simple.args.myval);
      assert('on_load() copied it to this.data.myval', simple.data.myval === 'hello', simple.data.myval);
      const text = simple.$.find('p').text().replace(/\s+/g, ' ').trim();
      assert('template renders "Value from args: hello"', text === 'Value from args: hello', text);
    }

    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
