/**
 * Unit tests for <pre> and <textarea> raw-content handling.
 *
 * <pre> is a raw-text element: its body is lexed as literal text up to </pre>, so
 * nested markup survives and whitespace is preserved byte for byte. Tokenizing that
 * body as tags is what destroyed the line breaks <pre> exists to keep, and it made
 * <pre><code>...</code></pre> - the standard code-block idiom - a compile error.
 *
 * <textarea> keeps the stricter rule: its HTML content model is text only.
 *
 * Both previously flattened their children with (child).content, so an expression
 * inside either tag emitted the literal string "undefined".
 */

import { compileTemplate } from '../dist/compiler.js';
import assert from 'assert';

function compile(body) {
  const { code } = compileTemplate(
    `<Define:X tag="div">\n  ${body}\n</Define:X>\n`,
    'test.jqhtml',
    { format: 'iife', sourcemap: false }
  );
  return code;
}

function rawContent(body) {
  const code = compile(body);
  const match = code.match(/\{rawtag: \["[^"]+", \{[^}]*\}, ([\s\S]*?)\]\}\);/);
  assert.ok(match, 'expected a rawtag instruction');
  return match[1];
}

describe('Raw content tags', () => {

  describe('<pre>', () => {

    it('should allow nested markup (regression)', () => {
      assert.doesNotThrow(() => compile('<pre><code>x</code></pre>'));
      assert.doesNotThrow(() => compile('<pre><code class="language-js">x</code></pre>'));
    });

    it('should keep nested markup verbatim in the content', () => {
      const content = rawContent('<pre><code class="lang">x</code></pre>');
      assert.ok(content.includes('<code class=\\"lang\\">'), content);
      assert.ok(content.includes('</code>'), content);
    });

    it('should interpolate expressions rather than emitting undefined (regression)', () => {
      const content = rawContent('<pre><%= this.data.code %></pre>');
      assert.ok(content.includes('escape_html'), content);
      assert.ok(!content.includes('undefined'), content);
    });

    it('should interpolate expressions inside nested markup', () => {
      const content = rawContent('<pre><code class="language-<%= this.data.lang %>"><%= this.data.code %></code></pre>');
      assert.ok(!content.includes('undefined'), content);
      assert.strictEqual(content.match(/escape_html\(/g).length, 2, content);
    });

    it('should not escape an unescaped expression', () => {
      const content = rawContent('<pre><%!= this.data.html %></pre>');
      assert.ok(content.includes('String('), content);
      assert.ok(!content.includes('escape_html'), content);
    });

    it('should preserve interior newlines and indentation', () => {
      const content = rawContent('<pre>one\n    two\n\n  three</pre>');
      assert.strictEqual((content.match(/\\n/g) || []).length, 3, content);
      assert.ok(content.includes('    two'), content);
    });

    it('should not let an expression containing </pre> end the block early', () => {
      assert.doesNotThrow(() => compile('<pre><%= "</pre>" %>after</pre>'));
    });

    it('should reject a code block, which has nowhere to write output', () => {
      assert.throws(() => compile('<pre><% if (x) { %>a<% } %></pre>'), /Invalid content in <pre>/);
    });

  });

  describe('<textarea>', () => {

    it('should interpolate expressions rather than emitting undefined (regression)', () => {
      const content = rawContent('<textarea><%= this.data.value %></textarea>');
      assert.ok(content.includes('escape_html'), content);
      assert.ok(!content.includes('undefined'), content);
    });

    it('should still reject nested markup', () => {
      assert.throws(() => compile('<textarea><div>x</div></textarea>'), /Invalid content in <textarea>/);
    });

    it('should still accept plain text', () => {
      assert.strictEqual(rawContent('<textarea>plain</textarea>'), '"plain"');
    });

  });

});
