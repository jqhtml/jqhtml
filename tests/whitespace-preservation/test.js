/**
 * whitespace-preservation - whitespace between nodes is kept as (at least) one space,
 * runs collapse, and minified markup gets no space added.
 *
 * Assertions compare COLLAPSED text/markup (every whitespace run -> one space, then
 * trimmed), so they pin where a space is and is not, not how many characters the
 * template's indentation leaves behind. Case 9 renders two spaces before "Line1"; that
 * is accepted as is (decision 2026-10-19) and the collapsed comparison covers it.
 */
class Whitespace_Test extends Jqhtml_Component {
  on_ready() {
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
    const collapse = (s) => s.replace(/\s+/g, ' ').trim();
    const html = (id) => collapse(this.$.find('#' + id).html());
    const text = (id) => collapse(this.$.find('#' + id).text());

    assert('test1: space between two expressions -> "Jane Smith"', text('test1') === 'Jane Smith', text('test1'));
    assert('test2: space between inline elements kept',
      html('test2') === '<span>Foo</span> <span>Bar</span>', html('test2'));
    assert('test3: minified markup gets no space',
      html('test3') === '<span>Foo</span><span>Bar</span>', html('test3'));
    const t4 = this.$.find('#test4 span').text();
    assert('test4: leading/trailing spaces inside text kept', t4 === ' hello ', t4);
    assert('test5: run of spaces between elements -> one space',
      html('test5') === '<span>A</span> <span>B</span>', html('test5'));
    assert('test6: newline between elements -> one space',
      html('test6') === '<span>Line1</span> <span>Line2</span>', html('test6'));
    assert('test7: spaces around expressions and elements kept',
      html('test7') === 'Hello <strong>world</strong> !', html('test7'));
    assert('test8: space between block elements kept',
      html('test8') === '<div>Block1</div> <div>Block2</div>', html('test8'));
    assert('test9: <br /> kept with no space added around it',
      html('test9') === 'Line1<br>Line2', html('test9'));
    const strong10 = this.$.find('#test10 strong').text();
    assert('test10: trailing space inside <strong> kept', strong10 === 'Contact: ', strong10);
    assert('test10: nested text reads "Contact: John Doe"', text('test10') === 'Contact: John Doe', text('test10'));

    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
