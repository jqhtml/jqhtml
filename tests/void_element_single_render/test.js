/**
 * void_element_single_render
 *
 * Regression test for the double-<br> bug: codegen's line-mapped path used to
 * emit a stray closing-tag string after every void element instruction
 * (e.g. _output.push("</br>")). Browsers parse a stray </br> as a SECOND <br>
 * element, so every template <br> rendered as a double line break. The fix
 * (packages/parser/src/codegen.ts, VOID_ELEMENTS guard) skips the closing-tag
 * emission for the HTML5 void element set:
 *   area base br col embed hr img input link meta source track wbr
 *
 * This test renders void elements at top level and nested, then asserts each
 * appears in the DOM EXACTLY as many times as written - not doubled.
 */
class Void_Element_Single_Render_Main extends Jqhtml_Component {
  on_ready() {
    setTimeout(() => {
      console.log('');
      console.log('========================================');
      console.log('TESTING VOID ELEMENTS RENDER EXACTLY ONCE');
      console.log('========================================');
      const tests = [];

      const check = (label, actual, expected) => {
        if (actual === expected) {
          console.log(`✅ TEST ${tests.length + 1} PASS: ${label} (${actual})`);
          tests.push(true);
        } else {
          console.log(`❌ TEST ${tests.length + 1} FAIL: ${label} - expected ${expected}, got ${actual}`);
          tests.push(false);
        }
      };

      // Template writes exactly: 3 <br> total (2 in para + 1 nested), 1 <hr>,
      // 1 <input>, 1 <img>
      check('total <br> count', this.$.find('br').length, 3);
      check('<br> inside $sid=para', this.$sid('para').find('br').length, 2);
      check('<br> inside nested span', this.$sid('nested').find('br').length, 1);
      check('<hr> count', this.$.find('hr').length, 1);
      check('<input> count', this.$.find('input').length, 1);
      check('<img> count', this.$.find('img').length, 1);

      // The paragraph's text splits into exactly 3 lines (2 breaks), not 5
      const paraHtml = this.$sid('para').html();
      const brMatches = (paraHtml.match(/<br\s*\/?>/gi) || []).length;
      check('serialized <br> tags in para HTML', brMatches, 2);

      console.log('');
      if (tests.every(t => t)) {
        console.log('✅ ALL TESTS PASSED');
        $('#results').html('<span style="color: green;">✅ All tests passed</span>');
      } else {
        console.log('❌ SOME TESTS FAILED');
        $('#results').html('<span style="color: red;">❌ Some tests failed</span>');
      }
      console.log('========================================');
      window.testPassed = tests.every(t => t);
    }, 200);
  }
}
