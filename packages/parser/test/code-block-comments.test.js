/**
 * Unit tests for // line comments inside <% %> code blocks.
 *
 * Regression: a // comment whose first non-space chars on a line are "//"
 * was NOT stripped before JavaScript scanning. Any apostrophe (or quote)
 * inside such a comment flipped the lexer's string tracking, which then
 * swallowed the real %> and produced "Unterminated code block - expected %>".
 *
 * Rule: in a code block, if "//" is the first non-space character sequence on
 * a line, everything from "//" to end of line is ignored for parsing.
 */

import { Lexer, Parser, CodeGenerator } from '../dist/index.js';
import assert from 'assert';

function compile(template) {
  const lexer = new Lexer(template);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, template, 'test.jqhtml');
  const ast = parser.parse();
  const generator = new CodeGenerator();
  return generator.generate(ast);
}

describe('Code Block // Comments', () => {

  it('should not break on an apostrophe in a leading // comment (regression)', () => {
    const template = `<Define:Test>
<%
// this won't render
let y = 5;
%>
<div><%= y %></div>
</Define:Test>`;

    assert.doesNotThrow(() => compile(template),
      'Apostrophe inside a // comment must not cause an unterminated code block');

    const result = compile(template);
    // The real code survives...
    assert.ok(result.code.includes('let y = 5'), 'Code after the comment should be preserved');
    // ...but the comment text is stripped (not emitted as live code).
    assert.ok(!result.code.includes("won't render"), 'Comment text should be stripped');
  });

  it('should strip an indented leading // comment', () => {
    const template = `<Define:Test>
<%
    // indented, don't break here either
let z = 7;
%>
<div><%= z %></div>
</Define:Test>`;

    assert.doesNotThrow(() => compile(template));
    const result = compile(template);
    assert.ok(result.code.includes('let z = 7'), 'Code should be preserved');
    assert.ok(!result.code.includes("don't break"), 'Indented comment should be stripped');
  });

  it('should handle a double quote in a leading // comment', () => {
    const template = `<Define:Test>
<%
// he said "hello" and didn't stop
let q = 1;
%>
<div><%= q %></div>
</Define:Test>`;

    assert.doesNotThrow(() => compile(template));
    const result = compile(template);
    assert.ok(result.code.includes('let q = 1'), 'Code should be preserved');
  });

  it('should ignore %> that appears inside a leading // comment', () => {
    const template = `<Define:Test>
<%
// this looks like a close %> but isn't
let n = 42;
%>
<div><%= n %></div>
</Define:Test>`;

    assert.doesNotThrow(() => compile(template));
    const result = compile(template);
    assert.ok(result.code.includes('let n = 42'), 'Real code after a comment-with-%> should be preserved');
  });

  it('should still preserve real string literals containing //', () => {
    const template = `<Define:Test>
<%
let url = "https://example.com";
%>
<div><%= url %></div>
</Define:Test>`;

    assert.doesNotThrow(() => compile(template));
    const result = compile(template);
    assert.ok(result.code.includes('https://example.com'),
      '// inside a string literal must NOT be treated as a comment');
  });

  it('should preserve normal multi-line code blocks without comments', () => {
    const template = `<Define:Test>
<%
let a = 1;
let b = 2;
%>
<div><%= a + b %></div>
</Define:Test>`;

    assert.doesNotThrow(() => compile(template));
    const result = compile(template);
    assert.ok(result.code.includes('let a = 1'), 'First line preserved');
    assert.ok(result.code.includes('let b = 2'), 'Second line preserved');
  });
});

console.log('Code block // comment unit tests defined');
