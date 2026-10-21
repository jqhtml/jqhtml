/**
 * Unit tests for the shared JavaScript scanner (src/js_scanner.ts).
 *
 * Every compiler site that finds the end of a JS region or skips over JS uses this
 * scanner: the %> closing <% %> / <%= %>, comment stripping in those blocks, the )
 * closing $attr=(...), the } closing <{expr}>, and codegen's push merging. These
 * tests pin its rules: strings with escapes, template literals with nested ${},
 * line/block comments (a line comment always runs to its newline, hiding %>),
 * regex-vs-division by the preceding token, and %> handling.
 */

import {
  scan_js,
  find_template_close,
  find_matching_bracket,
  find_statement_end,
  blank_line_comments,
  find_hidden_closes
} from '../dist/js_scanner.js';
import assert from 'assert';

// Index of the %> closing a block body, as an offset from the body start
const close = body => find_template_close(body + ' REST', 0);
// The body text up to its closing %>
const body_of = text => text.slice(0, find_template_close(text, 0));

describe('JS scanner: strings and escapes', () => {
  it('hides %> inside single, double and template strings', () => {
    assert.strictEqual(body_of(`"a %> b" %> x`), `"a %> b" `);
    assert.strictEqual(body_of(`'a %> b' %> x`), `'a %> b' `);
    assert.strictEqual(body_of('`a %> b` %> x'), '`a %> b` ');
  });

  it('handles escaped quotes and escaped backslashes', () => {
    assert.strictEqual(body_of(`"a\\"%>" %> x`), `"a\\"%>" `);
    assert.strictEqual(body_of(`'a\\\\' %> x`), `'a\\\\' `);
    assert.strictEqual(body_of(`"it's" %> x`), `"it's" `);
  });

  it('reports -1 for an unterminated string', () => {
    assert.strictEqual(find_template_close(`"abc %>`, 0), -1);
  });
});

describe('JS scanner: template literals', () => {
  it('scans ${} interpolations as code', () => {
    assert.strictEqual(body_of('`a${ b }c` %> x'), '`a${ b }c` ');
  });

  it('handles nested strings, braces and templates inside ${}', () => {
    const src = '`a${ {k: "}"}.k + `in${ `deep ${ "%>" }` }` }z` %> x';
    assert.strictEqual(body_of(src), src.slice(0, src.indexOf(' %> x') + 1));
  });

  it('handles a regex and a comment inside ${}', () => {
    const src = '`${ s.replace(/`/g, "") /* } */ }` %> x';
    assert.strictEqual(body_of(src), src.slice(0, src.indexOf(' %> x') + 1));
  });

  it('reports -1 for an unterminated template or interpolation', () => {
    assert.strictEqual(find_template_close('`abc %>', 0), -1);
    assert.strictEqual(find_template_close('`a${ b %>', 0), -1);
  });
});

describe('JS scanner: comments', () => {
  it('a block comment hides %>', () => {
    assert.strictEqual(body_of('a /* %> */ b %> x'), 'a /* %> */ b ');
  });

  it('a line comment hides %>: it runs to the end of its line', () => {
    assert.strictEqual(find_template_close('a // note %> x', 0), -1);
    assert.strictEqual(body_of('a // note %> x\nb %> y'), 'a // note %> x\nb ');
    assert.strictEqual(body_of(`a // don't %> x\n%> y`), `a // don't %> x\n`);
  });

  it('a line comment on its own line inside a block runs to the end of that line', () => {
    const src = 'a\n  // looks like %> but is not\nb %> x';
    assert.strictEqual(body_of(src), 'a\n  // looks like %> but is not\nb ');
  });

  it('a line comment ends at the newline', () => {
    assert.strictEqual(body_of('a // "unclosed\nb %> x'), 'a // "unclosed\nb ');
  });

  it('outside template mode a line comment runs to the newline', () => {
    let seen = null;
    scan_js('a // %> b\nc', 0, { on_line_comment: (s, e) => { seen = [s, e]; } });
    assert.deepStrictEqual(seen, [2, 9]);
  });

  it('blank_line_comments replaces comments with spaces, keeping length and newlines', () => {
    const src = 'a(); // one\nb = "//not"; // two\nc = /\\/\\//g;';
    const out = blank_line_comments(src);
    assert.strictEqual(out.length, src.length);
    assert.strictEqual(out, 'a();       \nb = "//not";       \nc = /\\/\\//g;');
  });

  it('blank_line_comments in template mode blanks a comment past %> to the newline', () => {
    assert.strictEqual(blank_line_comments('a // c %> d\n%> e', true), 'a' + ' '.repeat(10) + '\n%> e');
  });

  it('find_hidden_closes reports each %> a line comment hides', () => {
    const src = 'a(); // x %> y\n  // mid %> sentence\n  // ends %>\n%> z';
    assert.deepStrictEqual(find_hidden_closes(src, 0), [
      { comment: 5, close: 10, suspicious: true },    // follows code
      { comment: 17, close: 24, suspicious: false },  // own line, %> mid-sentence
      { comment: 38, close: 46, suspicious: true }    // own line, %> ends it
    ]);
    assert.deepStrictEqual(find_hidden_closes('// %> x\n%>', 0),
      [{ comment: 0, close: 3, suspicious: true }]);  // on the opening line
    assert.deepStrictEqual(find_hidden_closes('a = "// %>"; /* // %> */ %>', 0), []);
  });
});

describe('JS scanner: regex literals vs division', () => {
  const regex_cases = [
    ['s.replace(/\'/g, "")', 'after ('],
    ['x = /"/', 'after ='],
    ['f(a, /%>/)', 'after ,'],
    ['[/]/]', 'after ['],
    ['!/x/.test(s)', 'after !'],
    ['a && /\'/.test(s)', 'after &&'],
    ['a || /\'/.test(s)', 'after ||'],
    ['c ? /\'/ : /"/', 'after ? and :'],
    ['; /\'/.test(s)', 'after ;'],
    ['{ /\'/.test(s) }', 'after { and }'],
    ['return /\'/.test(s)', 'after return'],
    ['typeof /\'/', 'after typeof'],
    ['/\'/.test(s)', 'at the start'],
    ['p.replace(/\\//g, " > ")', 'escaped slash'],
    ['s.match(/[/\'"]/)', 'slash and quotes in a class'],
  ];
  for (const [code, why] of regex_cases) {
    it(`treats / as a regex ${why}: ${code}`, () => {
      assert.strictEqual(body_of(code + ' %> x'), code + ' ');
    });
  }

  const division_cases = [
    ['a / b / c', 'after identifiers'],
    ['10 / 2', 'after a number'],
    ['(a) / 2', 'after )'],
    ['arr[0] / 2', 'after ]'],
    ['"s".length / 2', 'after a property'],
  ];
  for (const [code, why] of division_cases) {
    it(`treats / as division ${why}: ${code}`, () => {
      assert.strictEqual(body_of(code + ' %> x'), code + ' ');
    });
  }

  it('division followed by a quote is not mistaken for a regex', () => {
    // If "/ 2 + '" were read as a regex, the quote would be skipped
    const code = `a / 2 + 'x %> y' / 3`;
    assert.strictEqual(body_of(code + ' %> x'), code + ' ');
  });

  it('a / with no closing / on its line is division', () => {
    const code = '= /';
    assert.strictEqual(find_template_close(code + ' %> x', 0), code.length + 1);
  });
});

describe('JS scanner: helpers', () => {
  it('find_matching_bracket skips literals and comments', () => {
    const src = `(a, ")", ')', \`)\${")"}\`, /\\)/, /* ) */ b)tail`;
    assert.strictEqual(find_matching_bracket(src, 0), src.indexOf(')tail'));
    assert.strictEqual(find_matching_bracket('{ a: { b: "}" } } x', 0), 16);
    assert.strictEqual(find_matching_bracket('(a', 0), -1);
  });

  it('find_statement_end stops at a top-level ; only', () => {
    const src = 'f(";", {a: 1; }, /;/); g();';
    assert.strictEqual(find_statement_end(src, 0), src.indexOf(' g()'));
    assert.strictEqual(find_statement_end('a = 1', 0), 5);
  });

  it('scan_js reports -1 for an unterminated block comment', () => {
    assert.strictEqual(close('a /* b %>'), -1);
  });
});
