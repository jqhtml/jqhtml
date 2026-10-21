class Outer_Component extends Jqhtml_Component {
  async on_ready() {
    console.log('[Outer] on_ready - creating Inner_Component');
    let $content = this.$sid('content');
    $content.component("Inner_Component", {});
    console.log('[Outer] Inner_Component created');

    // inner.jqhtml has CRLF line endings (run-test.sh checks; .gitattributes keeps them).
    // Its text content must survive compilation.
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

    const inner = this.$sid('content').component();
    assert('Inner_Component mounted on <main $sid="content">', !!inner && inner.component_name() === 'Inner_Component');
    if (inner) await inner.ready();
    const $main = this.$sid('content');
    assert('root stays a <main> element', $main.is('main'), $main.prop('tagName'));
    assert('root carries the Inner_Component class', $main.hasClass('Inner_Component'), $main.attr('class'));
    const text = $main.text().replace(/\s+/g, ' ').trim();
    assert('CRLF template text rendered: "Hello world!"', text === 'Hello world!', text);
    assert('no stray carriage return in the output', $main.html().indexOf('\r') === -1);

    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
