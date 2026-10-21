class Js_Regions_Probe extends Jqhtml_Component {
  on_ready() {
    let failed = 0;
    const check = (name, actual, expected) => {
      if (actual === expected) {
        console.log('PASS: ' + name);
      } else {
        console.log('FAIL: ' + name + ' expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
        failed++;
      }
    };

    // A // comment runs to the end of its line: a %> inside it does not close the tag
    check('<b>hi</b> after a trailing comment renders', this.$sid('trailing').find('b').text(), 'hi');
    check('the commented-out <b> is not rendered', this.$sid('trailing').find('b').length, 1);
    check('</span> after <% } // end %> on the next line closes the span', this.$sid('closing').text(), 'a');
    check('sibling after the span is not nested in it', this.$sid('closing').find('i').length, 0);
    check('sibling after the span renders', this.$sid('after_span').text(), 'after');
    check('<%= expr // comment %> closes on the next line', this.$sid('label').text(), 'L');
    check('<%!= expr // comment %> closes on the next line', this.$sid('raw').text(), 'L');
    check('<% foo(); // <% blah %> closes on the next line', this.$sid('opened').text(), 'o');
    check('a comment line mentioning <% %> in a multi-line block', this.$sid('leading').text(), 'l');
    check('// and %> inside strings are not a comment', this.$sid('url').text(), 'http://a//b %> c');
    // Regex literals inside <%= %> / <% %> evaluate
    check('regex with escaped slash', this.$sid('regex_slash').text(), 'a > b > c');
    check('regex with quotes in a class', this.$sid('regex_quotes').text(), 'its q');
    check('%> inside a regex', this.$sid('regex_close').text(), 'yes');

    console.log('SUMMARY: ' + (13 - failed) + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
