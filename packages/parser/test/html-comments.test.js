/**
 * Unit tests for HTML comment handling
 */

import { Lexer, Parser, CodeGenerator } from '../dist/index.js';
import assert from 'assert';

describe('HTML Comments', () => {

  it('should preserve simple HTML comments', () => {
    const template = `<Define:Test>
      <!-- This is an HTML comment -->
      <div>Content</div>
    </Define:Test>`;

    const lexer = new Lexer(template);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, template, 'test.jqhtml');
    const ast = parser.parse();

    const generator = new CodeGenerator();
    const result = generator.generate(ast);

    assert.ok(result.code.includes('<!-- This is an HTML comment -->'),
      'HTML comment should be preserved in output');
  });

  it('should preserve special characters in HTML comments', () => {
    const template = `<Define:Test>
      <!-- Special: <> & " ' -->
      <div>Content</div>
    </Define:Test>`;

    const lexer = new Lexer(template);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, template, 'test.jqhtml');
    const ast = parser.parse();

    const generator = new CodeGenerator();
    const result = generator.generate(ast);

    // The comment is emitted inside a double-quoted JS string, so the literal
    // double quote is backslash-escaped (\") in the generated source; the
    // apostrophe needs no escaping. Assert on the actually-emitted form.
    assert.ok(result.code.includes('<!-- Special: <> & \\" \' -->'),
      'Special characters in HTML comments should be preserved');
  });

  it('should not parse JQHTML syntax inside HTML comments', () => {
    const template = `<Define:Test>
      <!-- Should ignore: <%= this.data.value %> -->
      <div><%= this.data.real %></div>
    </Define:Test>`;

    const lexer = new Lexer(template);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, template, 'test.jqhtml');
    const ast = parser.parse();

    const generator = new CodeGenerator();
    const result = generator.generate(ast);

    // The <%= inside comment should be preserved as literal text
    assert.ok(result.code.includes('<!-- Should ignore: <%= this.data.value %> -->'),
      'JQHTML syntax in HTML comments should not be parsed');

    // But the real expression should be parsed
    assert.ok(result.code.includes('this.data.real'),
      'Real expressions outside comments should be parsed');
  });

  it('should handle multi-line HTML comments', () => {
    const template = `<Define:Test>
      <!--
        Multi-line comment
        With multiple lines
        And content
      -->
      <div>Content</div>
    </Define:Test>`;

    const lexer = new Lexer(template);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, template, 'test.jqhtml');
    const ast = parser.parse();

    const generator = new CodeGenerator();
    const result = generator.generate(ast);

    assert.ok(result.code.includes('<!--'), 'Should include comment start');
    assert.ok(result.code.includes('Multi-line comment'), 'Should preserve comment content');
    assert.ok(result.code.includes('-->'), 'Should include comment end');
  });

  it('should handle multiple HTML comments', () => {
    const template = `<Define:Test>
      <!-- First -->
      <div>Content</div>
      <!-- Second -->
      <p>More</p>
      <!-- Third -->
    </Define:Test>`;

    const lexer = new Lexer(template);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, template, 'test.jqhtml');
    const ast = parser.parse();

    const generator = new CodeGenerator();
    const result = generator.generate(ast);

    assert.ok(result.code.includes('<!-- First -->'), 'Should include first comment');
    assert.ok(result.code.includes('<!-- Second -->'), 'Should include second comment');
    assert.ok(result.code.includes('<!-- Third -->'), 'Should include third comment');
  });

  it('should handle edge cases in HTML comments', () => {
    const template = `<Define:Test>
      <!-- Edge case <!-- not nested --> comment -->
      <div>Content</div>
    </Define:Test>`;

    const lexer = new Lexer(template);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, template, 'test.jqhtml');
    const ast = parser.parse();

    const generator = new CodeGenerator();
    const result = generator.generate(ast);

    // The first --> should close the comment
    assert.ok(result.code.includes('<!-- Edge case <!-- not nested -->'),
      'Should handle apparent nesting correctly');
  });

  it('should distinguish HTML comments from JQHTML comments', () => {
    const template = `<Define:Test>
      <!-- HTML comment - will appear in output -->
      <%-- JQHTML comment - will not appear in output --%>
      <div>Content</div>
    </Define:Test>`;

    const lexer = new Lexer(template);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, template, 'test.jqhtml');
    const ast = parser.parse();

    const generator = new CodeGenerator();
    const result = generator.generate(ast);

    assert.ok(result.code.includes('<!-- HTML comment'),
      'HTML comment should be in output');
    assert.ok(!result.code.includes('JQHTML comment'),
      'JQHTML comment should not be in output');
  });

  it('should throw error for unterminated HTML comments', () => {
    const template = `<Define:Test>
      <!-- Unterminated comment
      <div>Content</div>
    </Define:Test>`;

    const lexer = new Lexer(template);

    assert.throws(() => {
      lexer.tokenize();
    }, /Unterminated HTML comment/, 'Should throw error for unterminated HTML comment');
  });
});

console.log('HTML comment unit tests defined');