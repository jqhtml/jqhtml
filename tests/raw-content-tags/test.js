class Raw_Content_Test extends Jqhtml_Component {
  on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

    let passed = 0;
    let failed = 0;
    const assert = (name, condition) => {
      if (condition) { console.log('   PASS: ' + name); passed++; }
      else { console.log('   FAIL: ' + name); failed++; }
    };
    const show = (s) => JSON.stringify(s);
    const val = (id) => this.$.find('#' + id).val();
    const text = (id) => this.$.find('#' + id)[0].textContent;

    console.log('');
    console.log('1. textarea AND pre KEEP THEIR CONTENT BYTE FOR BYTE:');
    const code = 'function hello() {\n    console.log("Hello World");\n    return true;\n}';
    assert('textarea keeps code indentation and newlines', val('code-textarea') === code);
    if (val('code-textarea') !== code) console.log('      got ' + show(val('code-textarea')));

    const ascii = '   _____\n  /     \\\n | () () |\n  \\  ^  /\n   |||||\n   |||||';
    assert('pre keeps ASCII art exactly', text('ascii-pre') === ascii);
    if (text('ascii-pre') !== ascii) console.log('      got ' + show(text('ascii-pre')));

    console.log('');
    console.log('2. NO TRIMMING OR WHITESPACE COLLAPSING:');
    assert('leading/trailing newlines survive', /\n\s*$/.test(val('newlines-textarea'))
      && val('newlines-textarea').includes('Content with newlines before and after'));
    assert('tabs are preserved verbatim', text('mixed-pre').includes('Line1\t\twith\t\ttabs'));
    assert('run of spaces is not collapsed', text('mixed-pre').includes('Line2 with    spaces'));
    assert('whitespace-only pre is not trimmed away', /\n/.test(text('whitespace-pre')));

    console.log('');
    console.log('3. RAW-TAG CONTENT IS RE-ESCAPED, SO SOURCE TEXT SHOWS VERBATIM:');
    // The codegen escapes `&`, `<` and `>` in rawtag content, so an entity written in
    // the template reaches the textarea as the literal characters the author typed.
    const entities = val('entities-textarea');
    assert('textarea shows the source characters verbatim',
      entities === '&lt;div class="test"&gt;\n  &lt;span&gt;Content &amp; more&lt;/span&gt;\n&lt;/div&gt;');
    if (entities !== '&lt;div class="test"&gt;\n  &lt;span&gt;Content &amp; more&lt;/span&gt;\n&lt;/div&gt;') console.log('      got ' + show(entities));
    assert('nothing in it became markup', this.$.find('#entities-textarea span').length === 0);

    console.log('');
    console.log('4. EMPTY RAW TAGS STAY EMPTY:');
    assert('empty textarea has no value', val('empty-textarea') === '');
    assert('empty pre has no text', text('empty-pre') === '');

    console.log('');
    console.log('5. NESTING AND ATTRIBUTES:');
    assert('nested textarea kept its content', val('nested-textarea') === 'if (condition) {\n  doSomething();\n}');
    assert('nested pre kept its content', text('nested-pre') === 'Expected output:\n  Result: true');
    assert('textarea attributes applied', this.$.find('#attrs-textarea').prop('disabled') === true
      && this.$.find('#attrs-textarea').hasClass('form-control')
      && this.$.find('#attrs-textarea').attr('rows') === '3');
    assert('pre attributes applied', this.$.find('#attrs-pre').attr('data-language') === 'javascript'
      && this.$.find('#attrs-pre').hasClass('highlight'));
    assert('pre with attributes kept its content', text('attrs-pre') === 'const x = 42;');

    console.log('');
    console.log('========================================');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    console.log('');

    window.testPassed = (failed === 0);
    window.testReady = true;
  }
}
