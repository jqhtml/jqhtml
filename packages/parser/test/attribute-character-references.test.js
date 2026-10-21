/**
 * Character references in quoted attribute values are resolved at compile time the
 * way the HTML tokenizer resolves them, so the compiled value is the string the
 * browser gives static HTML (`title="a &amp; b"` compiles to "a & b").
 *
 * The reference is jsdom's HTML parser (parse5, a WHATWG-conformant tokenizer): every
 * case is parsed as `<b title="...">` there and compiled here, and the two values must
 * be identical. Covered: named references with and without ';', the historical
 * attribute rule (`&amp=x`, `&copyx` stay literal), longest match, numeric references
 * (decimal, hex, missing ';', no digits, 0, surrogates, past U+10FFFF, the C1 remap),
 * a single-quoted value holding double quotes and the reverse, text around <%= %>
 * parts, and Define / component / $ values.
 */

import { compileTemplate } from '../dist/index.js';
import { JSDOM } from 'jsdom';
import assert from 'assert';

const document = new JSDOM('').window.document;

/** The value the browser's HTML parser gives `<b title=QUOTED>`. */
function html_value(quoted) {
  const div = document.createElement('div');
  div.innerHTML = `<b title=${quoted}></b>`;
  return div.firstChild.getAttribute('title');
}

/** The value the compiler puts in the tag instruction for `title=QUOTED`. */
function compiled_value(quoted, key = 'title', markup = (q) => `<b title=${q}>x</b>`) {
  const { code } = compileTemplate(`<Define:T_Ref>${markup(quoted)}</Define:T_Ref>`, 't.jqhtml',
    { version: 't', format: 'cjs', sourcemap: false });
  const match = code.match(new RegExp(`"${key.replace(/\$/g, '\\$')}": ("(?:[^"\\\\]|\\\\.)*")`));
  assert(match, `no ${key} in ${code}`);
  return JSON.parse(match[1]);
}

const CASES = [
  'plain text',
  'a &amp; b',
  '&lt;i&gt; &quot;q&quot; &apos;',
  '&amp',
  '&amp;amp;',
  '&AMP &AMP; &Amp;',
  '&nbsp;|&nbsp|&nbspx',
  '&copy &copy; &copyx &copy=1 &copy-1 &copy;x',
  '?a=1&copy=2&b=3&lang=en&amp;x=1',
  '&notin; &notit; &not &noti',
  '&Afr; &NotNestedLessLess; &acE;',
  '&nosuch; &nosuch &; & ; &&amp;',
  '&#39; &#x27; &#X27; &#039; &#0000065;',
  '&#65 &#x41 &#x41x &#65x &#x41;',
  '&# &#; &#x &#x; &#xg; &#-1;',
  '&#0; &#x0; &#xD800; &#xDFFF; &#x110000; &#99999999999; &#x10FFFF;',
  '&#x80; &#x81; &#x8D; &#x99; &#x9F; &#150; &#x7F;',
  '&#x1F600; &#128512;',
  'é   tail',
];

describe('attribute character references match the HTML parser', () => {
  for (const text of CASES) {
    test(JSON.stringify(text), () => {
      const quoted = `"${text}"`;
      assert.strictEqual(compiled_value(quoted), html_value(quoted));
    });
  }

  test('generated strings of &, #, x, digits, names, ; and =', () => {
    const pieces = ['&', '&', '#', 'x', 'X', '3', '9', 'A', 'f', ';', '=', ' ', 'amp', 'lt', 'copy', 'not', 'in', 'nbsp', '0', '1F'];
    let seed = 12345;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let n = 0; n < 400; n++) {
      let text = '';
      const length = 1 + Math.floor(random() * 10);
      for (let i = 0; i < length; i++) text += pieces[Math.floor(random() * pieces.length)];
      const quoted = `"${text}"`;
      assert.strictEqual(compiled_value(quoted), html_value(quoted), JSON.stringify(text));
    }
  });

  test("double quotes inside a single-quoted value, and the reverse", () => {
    for (const quoted of [`'say "hi" &amp; &quot;bye&quot;'`, `"it's &apos;fine&#39;"`]) {
      assert.strictEqual(compiled_value(quoted), html_value(quoted));
    }
  });
});

describe('every attribute path gets the resolved value', () => {
  test('text around <%= %> parts is resolved; the expression is not touched', () => {
    const { code } = compileTemplate(
      '<Define:T_Ref><b alt="a &amp; <%= x %> &quot;&lt;%= y %&gt;">x</b></Define:T_Ref>', 't.jqhtml',
      { version: 't', format: 'cjs', sourcemap: false });
    assert(code.includes('"alt": "a & " + (x) + " \\"<%= y %>"'), code);
  });

  test('Define defaults, component attributes and $ args', () => {
    const { code } = compileTemplate(
      '<Define:T_Ref class="a&amp;b" style="content: &quot;x&quot;" $label="&nbsp;">' +
      '<Foo title="&lt;i&gt;" $arg="1 &amp; 2" $expr=count /></Define:T_Ref>', 't.jqhtml',
      { version: 't', format: 'cjs', sourcemap: false });
    assert(code.includes('defaultAttributes: {"class": "a&b", "style": "content: \\"x\\""}'), code);
    assert(code.includes('"title": "<i>"'), code);
    assert(code.includes('"$arg": "1 & 2"'), code);
    assert(code.includes('"$expr": count'), code);
    assert(code.includes('defineArgs: {"label": "\u00a0"}'), code);
  });

  test('conditional attributes resolve too', () => {
    assert.strictEqual(
      compiled_value('"c &amp; d"', 'title', (q) => `<p <% if (y) { %>title=${q}<% } %>>p</p>`),
      'c & d');
  });

  test('element text is left for the browser (unchanged)', () => {
    const { code } = compileTemplate('<Define:T_Ref><b>t &amp; u</b></Define:T_Ref>', 't.jqhtml',
      { version: 't', format: 'cjs', sourcemap: false });
    assert(code.includes('"t &amp; u"'), code);
  });
});
