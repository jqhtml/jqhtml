/**
 * style_merge_css_values
 *
 * Merging two style strings (Define defaults + invocation, a nearer Define over a
 * farther one, a tracked element's own style) splits declarations the way the CSS
 * tokenizer does: ';' only at the top level (not in a string, comment or (), [], {}
 * block) and each declaration at its FIRST ':'. Before the fix every rule was split
 * on every ':' and ';', so url(http://...), data URIs and quoted font names were cut.
 *
 * Each case compares the browser's own parse of the merged attribute with its parse
 * of an equivalent hand-written style (the expected declarations in order, later
 * ones winning), property by property, plus a few direct checks.
 */
class Style_Merge_Css_Values extends Jqhtml_Component {
  on_click() {}

  async on_ready() {
    if (this.state.test_ran) return;
    this.state.test_ran = true;

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

    // The browser's parse of a style string, as {property: value [!important]}.
    const parsed = (style_text) => {
      const el = document.createElement('div');
      el.setAttribute('style', style_text);
      const out = {};
      for (let i = 0; i < el.style.length; i++) {
        const p = el.style[i];
        out[p] = el.style.getPropertyValue(p) + (el.style.getPropertyPriority(p) ? ' !important' : '');
      }
      return out;
    };
    const same = (name, $el, expected_text) => {
      const got = parsed($el.attr('style') || '');
      const want = parsed(expected_text);
      const ok = JSON.stringify(Object.entries(got).sort()) === JSON.stringify(Object.entries(want).sort());
      assert(name, ok, $el.attr('style'));
    };

    const base = "background: url(http://x.test/base.png) no-repeat; font-family: 'Base:Font;One', serif; color: red; --Gap: 1px; --gap: 2px";

    console.log('');
    console.log('1. DEFINE DEFAULTS + INVOCATION:');
    const plain = this.$sid('plain_merge');
    same('invocation color wins, url(http://...) and the quoted font name survive', plain, base + '; color: blue');
    assert('background keeps every colon', /url\(["']?http:\/\/x\.test\/base\.png["']?\)/.test(plain[0].style.backgroundImage), plain[0].style.backgroundImage);

    console.log('');
    console.log('2. QUOTED DATA URI / CSS STRING (single-quoted attribute):');
    const data_uri = this.$sid('data_uri');
    same('data URI and content string kept whole', data_uri,
      base + '; list-style-image: url("data:image/png;base64,iVBORw0KGgo="); content: "a;b:c"');
    assert('content is "a;b:c"', data_uri[0].style.content === '"a;b:c"', data_uri[0].style.content);

    console.log('');
    console.log('3. ESCAPED QUOTE INSIDE A CSS STRING:');
    const escaped = this.$sid('escaped');
    same('escaped quote does not end the string', escaped, base + "; content: 'it\\'s; fine'; margin: 1px");
    assert('margin parsed after the string', escaped[0].style.margin === '1px', escaped[0].style.margin);

    console.log('');
    console.log('4. BLOCKS AND COMMENTS:');
    const blocks = this.$sid('blocks');
    same('unquoted url(;), var() fallback and comment', blocks,
      base + '; cursor: url(data:image/png;base64,AAAA), auto; border-image-source: var(--img, url(a;b.png)); padding: 3px');
    assert('padding parsed after the comment', blocks[0].style.padding === '3px', blocks[0].style.padding);

    console.log('');
    console.log('5. NAME MATCHING:');
    const names = this.$sid('names');
    same('COLOR overrides color; --gap overrides --gap only', names, base + '; COLOR: blue; --gap: 9px');
    assert('--Gap kept (custom properties are case-sensitive)', names[0].style.getPropertyValue('--Gap').trim() === '1px', names[0].style.getPropertyValue('--Gap'));
    assert('one color declaration in the merged string', (names.attr('style').match(/color\s*:/gi) || []).length === 1, names.attr('style'));

    console.log('');
    console.log('6. !important:');
    const important = this.$sid('important');
    assert('invocation !important carried', important[0].style.getPropertyPriority('color') === 'important' && important[0].style.color === 'blue', important.attr('style'));

    console.log('');
    console.log('7. NEAREST DEFINE WINS:');
    const near_text = base + '; font-family: "Near;Font:Two"; COLOR: green';
    same('Smc_Near over Smc_Base', this.$sid('near'), near_text);
    same('invocation over both', this.$sid('near_invoked'), near_text + '; color: purple');

    console.log('');
    console.log('8. TRACKED ELEMENT (@click):');
    const tracked = this.$sid('tracked');
    same('own style survives the second pass', tracked, "background: url(http://x.test/t.png); font-family: 'T;1', serif; color: red");

    console.log('');
    console.log('9. SHORTHAND VS LONGHAND:');
    const shorthand = this.$sid('shorthand');
    same('invocation background-image survives the Define background shorthand', shorthand,
      base + '; background-image: url(http://x.test/inv.png)');
    assert('background-image is the invocation one', /inv\.png/.test(shorthand[0].style.backgroundImage), shorthand[0].style.backgroundImage);

    console.log('');
    console.log('10. !important IN THE LOSING STYLE:');
    const imp = "color: red !important; margin: 1px";
    const important_define = this.$sid('important_define');
    same('Define !important color kept, invocation margin wins', important_define, imp + '; color: blue; margin: 2px');
    assert('color is red !important', important_define[0].style.color === 'red' && important_define[0].style.getPropertyPriority('color') === 'important', important_define.attr('style'));
    const important_both = this.$sid('important_both');
    same('both !important: the invocation wins', important_both, imp + '; color: blue !important');

    console.log('');
    console.log('11. CHARACTER REFERENCES:');
    const entity = this.$sid('entity');
    same('&quot;a;b&quot; is one string', entity, base + '; content: "a;b"; color: blue');
    assert('content is "a;b"', entity[0].style.content === '"a;b"', entity[0].style.content);

    console.log('');
    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
