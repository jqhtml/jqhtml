/**
 * Unit tests for merging consecutive _output.push() calls.
 *
 * push(a); push(b); push(c)  ->  push(a, b, c)
 *
 * Array.prototype.push takes varargs and evaluates arguments left to right, so the
 * merge is behaviour-preserving; it trims call overhead and shortens the instruction
 * array the runtime walks.
 *
 * Merging is strictly within one line. Codegen is line-based so that generated line N
 * maps to source line N; moving a statement across a newline would silently
 * invalidate every sourcemap segment after it.
 */

import { compileTemplate } from '../dist/compiler.js';
import assert from 'assert';

function render_body(body) {
  const { code } = compileTemplate(
    `<Define:X tag="div">\n${body}\n</Define:X>\n`,
    'test.jqhtml',
    { format: 'iife', sourcemap: false }
  );
  return code;
}

const push_calls = code => (code.match(/_output\.push\(/g) || []).length;

describe('Output push merging', () => {

  it('should merge consecutive pushes on one line into a single call', () => {
    const code = render_body('  <h3>A</h3>');
    // opening tag + text + closing tag + leading space would be 4 separate calls
    assert.ok(code.includes('_output.push(" ", {tag: ["h3"'), code);
    assert.ok(code.includes('"A", "</h3>");'), code);
  });

  it('should not merge across a newline', () => {
    const code = render_body('  <p>one</p>\n  <p>two</p>');
    const body_lines = code.split('\n').filter(l => l.includes('_output.push('));
    assert.ok(body_lines.length >= 2, 'each source line keeps its own push call');
  });

  it('should not merge across control flow', () => {
    const code = render_body('  <% if (this.data.x) { %><p>y</p><% } %>');
    const line = code.split('\n').find(l => l.includes('if (this.data.x)'));
    assert.ok(line, 'control flow line present');
    assert.ok(line.indexOf('if (this.data.x)') < line.lastIndexOf('_output.push('),
      'the run is flushed before the if: ' + line);
  });

  it('should not merge pushes belonging to a nested closure', () => {
    const code = render_body('  <span>a</span><Child_C><b>i</b></Child_C>');
    // the inner function has its own _output binding; its pushes stay separate
    const line = code.split('\n').find(l => l.includes('function(Child_C)'));
    assert.ok(line, 'component child closure present');
    const inner = line.slice(line.indexOf('function(Child_C)'));
    assert.ok(push_calls(inner) >= 2, 'inner pushes are not merged into the outer call');
  });

  it('should not be confused by ); inside a string literal', () => {
    const code = render_body('  <p>text with ); semicolon</p><p>more</p>');
    assert.ok(code.includes('"text with ); semicolon"'), code);
    const line = code.split('\n').find(l => l.includes('semicolon'));
    assert.strictEqual(push_calls(line), 1, line);
  });

  it('should not be confused by an escaped quote inside a string literal', () => {
    const code = render_body('  <p>and "quoted );" too</p><p>more</p>');
    const line = code.split('\n').find(l => l.includes('quoted'));
    assert.strictEqual(push_calls(line), 1, line);
  });

  it('should preserve the generated line count', () => {
    const body = '  <p>a</p>\n  <p>b</p>\n  <% if (x) { %>\n  <p>c</p>\n  <% } %>';
    const { code } = compileTemplate(
      `<Define:X tag="div">\n${body}\n</Define:X>\n`,
      'test.jqhtml',
      { format: 'iife', sourcemap: true }
    );
    // compileTemplate throws if the sourcemap segment count and line count disagree,
    // so reaching here means merging kept every statement on its own line.
    assert.ok(code.includes('sourceMappingURL'));
  });

});
