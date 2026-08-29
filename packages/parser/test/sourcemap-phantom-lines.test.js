/**
 * Unit tests for sourcemap segment counts.
 *
 * Regression: generateSourcemapForWrappedCode() emitted one mapping segment per
 * SOURCE line regardless of how many lines the generated code actually had. A
 * component whose body renders nothing compiles to a one-line render function, so a
 * template with a multi-line <%-- --%> header produced far more segments than output
 * lines. Consumers that rebuild output from the map (source-map's
 * SourceNode.fromStringWithSourceMap, used by bundlers for concatenation) materialise
 * each of those phantom lines as a bare `undefined` identifier, which throws at
 * top level the moment the bundle executes.
 *
 * Rule: the sourcemap names exactly as many generated lines as the code has.
 */

import { compileTemplate } from '../dist/compiler.js';
import assert from 'assert';

function compile(template, filename = 'test.jqhtml') {
  const { code } = compileTemplate(template, filename, { format: 'iife', sourcemap: true });
  const match = code.match(/sourceMappingURL=data:application\/json;charset=utf-8;base64,([A-Za-z0-9+/=]+)/);
  assert.ok(match, 'compiled output should carry an inline sourcemap');
  const map = JSON.parse(Buffer.from(match[1], 'base64').toString());
  return {
    outputLines: code.replace(/\n\/\/# sourceMappingURL=.*$/, '').split('\n').length,
    segments: map.mappings.split(';').length
  };
}

describe('Sourcemap segment counts', () => {

  it('should not emit phantom lines for an empty body behind a multi-line comment (regression)', () => {
    const { outputLines, segments } = compile(
      '<%--\nTwo lines of comment\nis enough\n--%>\n<Define:X tag="div"></Define:X>\n'
    );
    assert.strictEqual(segments, outputLines);
  });

  it('should produce the same segment count with and without a long comment header', () => {
    const body = '<Define:X tag="div"></Define:X>\n';
    const bare = compile(body);
    const headed = compile('<%--\n' + 'header line\n'.repeat(40) + '--%>\n' + body);

    assert.strictEqual(headed.segments, headed.outputLines);
    assert.strictEqual(headed.segments, bare.segments);
  });

  it('should match output lines for a single-line comment', () => {
    const { outputLines, segments } = compile('<%-- one line --%>\n<Define:X tag="div"></Define:X>\n');
    assert.strictEqual(segments, outputLines);
  });

  it('should match output lines when the body renders something', () => {
    const { outputLines, segments } = compile(
      '<%--\nTwo lines of comment\nis enough\n--%>\n<Define:X tag="div"><p>hi</p></Define:X>\n'
    );
    assert.strictEqual(segments, outputLines);
  });

  it('should map every line of a template with more code than comment', () => {
    const template = [
      '<Define:X tag="div">',
      '  <% for (const item of this.data.items) { %>',
      '    <span><%= item %></span>',
      '  <% } %>',
      '</Define:X>',
      ''
    ].join('\n');
    const { outputLines, segments } = compile(template);
    assert.strictEqual(segments, outputLines);
  });

});
