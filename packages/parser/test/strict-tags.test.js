/**
 * The compiler rejects stray and mismatched tags and validates every render function.
 *
 * Unrecognised tokens in content used to be skipped, so a stray </span>, a lone </p>
 * or a stray %> vanished from the output and <b></i> reported "Unclosed tag: b".
 * Slot-only templates skipped JS validation entirely. The error formatter threw
 * "Invalid count value" for a column past the end of its line, hiding the real error.
 */

import { compileTemplate, JQHTMLParseError } from '../dist/index.js';
import assert from 'assert';

function compile_error(source) {
  try {
    compileTemplate(source, 'test.jqhtml', { format: 'iife', sourcemap: false });
  } catch (e) {
    return e;
  }
  assert.fail('expected the template to fail to compile:\n' + source);
}

function expect_error(source, first_line, line, column) {
  const e = compile_error(source);
  assert.strictEqual(e.message.split('\n')[0], first_line);
  assert.strictEqual(e.line, line);
  assert.strictEqual(e.column, column);
  assert.ok(e.message.includes(`at test.jqhtml:${line}:${column}`));
}

describe('stray and mismatched closing tags', () => {
  it('a closing tag that matches nothing open inside an element is a mismatch', () => {
    expect_error('<Define:Test>\n  <p>x</p>\n  <div>a</span></div>\n</Define:Test>',
      'Closing </span> does not match open <div> (line 3, col 9); <div> was opened at line 3, col 3', 3, 9);
  });

  it('<b></i> reports the mismatch, not an unclosed <b>', () => {
    expect_error('<Define:Test>\n<b></i>\n</Define:Test>',
      'Closing </i> does not match open <b> (line 2, col 4); <b> was opened at line 2, col 1', 2, 4);
  });

  it('a closing tag with nothing open says so', () => {
    expect_error('<Define:Test>\n  text </p>\n</Define:Test>',
      'Closing </p> has no matching open tag (line 2, col 8)', 2, 8);
  });

  it('a surplus closing tag after balanced markup has nothing open', () => {
    expect_error('<Define:Test>\n  <div>\n  </div>\n  </div>\n</Define:Test>',
      'Closing </div> has no matching open tag (line 4, col 3)', 4, 3);
  });

  it('a closing tag inside a slot with nothing open in the slot names the slot', () => {
    expect_error('<Define:Test>\n<Card><Slot:body>x</p></Slot:body></Card>\n</Define:Test>',
      'Closing </p> does not match open <Slot:body> (line 2, col 19); <Slot:body> was opened at line 2, col 7', 2, 19);
  });

  it('a mismatched dynamic closing tag inside an element is a mismatch', () => {
    expect_error('<Define:Test>\n<span></{this.x}></span>\n</Define:Test>',
      'Closing </{this.x}> does not match open <span> (line 2, col 7); <span> was opened at line 2, col 1', 2, 7);
  });

  it('a closing tag for an enclosing element reports the inner element as unclosed', () => {
    expect_error('<Define:Test>\n  <div><span>x\n  </div>\n</Define:Test>',
      'Unclosed tag: span (line 2, col 8); </div> (line 3, col 3) closes an enclosing element first', 2, 8);
    expect_error('<Define:Test>\n<Card><Slot:body><div></Slot:body></Card>\n</Define:Test>',
      'Unclosed tag: div (line 2, col 18); </Slot:body> (line 2, col 23) closes an enclosing element first', 2, 18);
    expect_error('<Define:Test>\n<Card><Slot:body>x</Card>\n</Define:Test>',
      'Unclosed slot: body (line 2, col 7); </Card> (line 2, col 19) closes an enclosing element first', 2, 7);
  });

  it('positions count from the line start with CRLF line endings', () => {
    expect_error('<Define:Test>\r\n  <div>\r\n  </span></div>\r\n</Define:Test>',
      'Closing </span> does not match open <div> (line 3, col 3); <div> was opened at line 2, col 3', 3, 3);
  });
});

describe('void elements', () => {
  it('a closing tag for a void element is rejected', () => {
    expect_error('<Define:Test>\n  a<br></br>\n</Define:Test>',
      'Closing </br> is not allowed: <br> is a void element and has no closing tag (line 2, col 8). Write <br> or <br /> alone.', 2, 8);
    expect_error('<Define:Test>\n<input type="text"></input>\n</Define:Test>',
      'Closing </input> is not allowed: <input> is a void element and has no closing tag (line 2, col 20). Write <input> or <input /> alone.', 2, 20);
  });

  it('a stray closing tag for a component named like a void element is an ordinary stray tag', () => {
    expect_error('<Define:Test>\n<div></Input></div>\n</Define:Test>',
      'Closing </Input> does not match open <div> (line 2, col 6); <div> was opened at line 2, col 1', 2, 6);
  });

  it('void elements without a closing tag, and self-closing components, stay valid', () => {
    compileTemplate('<Define:Test>\n<div><br><img src="x"><input type="text" /><hr/><User_Card /></div>\n<Input></Input>\n</Define:Test>',
      'test.jqhtml', { format: 'iife', sourcemap: false });
  });
});

describe('stray %> and nested <Define:>', () => {
  it('a stray %> fails with its position', () => {
    expect_error('<Define:Test>\n  hello %>\n</Define:Test>',
      'Stray %> with no matching <% (line 2, col 9)', 2, 9);
  });

  it('a <Define:> inside a definition fails', () => {
    expect_error('<Define:Test>\n  <div><Define:Foo /></div>\n</Define:Test>',
      '<Define:Foo> cannot appear inside a component definition (line 2, col 8)', 2, 8);
  });
});

describe('render function validation', () => {
  it('a slot-only template with invalid JS fails at the source line', () => {
    const e = compile_error('<%--\n  doc\n--%>\n<Define:Test>\n  <Slot:body>\n    <%= a + %>\n  </Slot:body>\n</Define:Test>');
    assert.match(e.message.split('\n')[0], /^JavaScript syntax error in component "Test": /);
    assert.strictEqual(e.line, 6);
  });

  it('a regular template with invalid JS fails at the source line', () => {
    const e = compile_error('<Define:Test>\n  <div>\n    <%= a + %>\n  </div>\n</Define:Test>');
    assert.match(e.message.split('\n')[0], /^JavaScript syntax error in component "Test": /);
    assert.strictEqual(e.line, 3);
  });

  it('a valid slot-only template compiles', () => {
    compileTemplate('<Define:Test>\n  <Slot:body>\n    <%= a + 1 %>\n  </Slot:body>\n</Define:Test>',
      'test.jqhtml', { format: 'iife', sourcemap: false });
  });
});

describe('error formatter', () => {
  it('does not throw for a column past the end of the line', () => {
    const e = new JQHTMLParseError('Boom', 2, 40, 'line one\nshort\nline three', 'f.jqhtml');
    assert.ok(e.message.startsWith('Boom\nat f.jqhtml:2:40'));
    assert.ok(e.message.includes('>     2 | short\n'));
    assert.ok(/\n {15}\^\n/.test(e.message), 'one caret just past the end of the line');
  });

  it('does not lose the snippet for a line past the end of the source', () => {
    const e = new JQHTMLParseError('Boom', 9, 3, 'one\ntwo', 'f.jqhtml');
    assert.ok(e.message.includes('>     2 | two\n'));
  });
});
