class Compiler_Text_Probe extends Jqhtml_Component {
  on_ready() {
    let passed = 0;
    let failed = 0;
    const check = (name, actual, expected) => {
      if (actual === expected) {
        console.log('PASS: ' + name);
        passed++;
      } else {
        console.log('FAIL: ' + name + ' expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
        failed++;
      }
    };

    // Non-breaking spaces are text, not collapsible whitespace
    check('NBSPs inside text are kept', this.$sid('nbsp').text(), 'a\u00a0\u00a0b\u00a0');
    check('a leading NBSP is kept', this.$sid('nbsp_lead').text(), '\u00a0c');
    // A multi-line <%= %> renders exactly its value - no whitespace text after it
    check('multi-line <%= %> output is exact', this.$sid('multi').html(), 'x');
    // (A <%= %> in an attribute value spanning lines is a compile error.)
    check('multi-line <%br= %> output is exact', this.$sid('br').html(), 'l1<br>l2');
    // A template literal with blank lines in a code block keeps its value
    check('template literal with blank lines is intact', this.$sid('literal').attr('title'), 'one\n\n  two\n    \nthree');
    // A comma expression evaluates to its last operand
    check('<%= 1, 2 %> renders 2', this.$sid('comma').text(), '2');
    check('comma expression in an attribute', this.$sid('comma_attr').attr('title'), 'b');
    // A trailing ; is accepted in an attribute expression, as in body expressions
    check('trailing ; in an attribute expression', this.$sid('semi').attr('title'), 'v');

    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
