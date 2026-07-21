#!/usr/bin/env node

/**
 * Test the new SourceMapGenerator implementation
 */

import { Lexer, Parser, CodeGenerator } from '../dist/index.js';
import { SourceMapConsumer } from 'source-map';

const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

async function testSourceMapGeneration() {
  console.log(colors.bold('Testing SourceMapGenerator Implementation\n'));

  const source = `<Define:TestComponent>
  <div class="test">
    <%= this.data.message %>
  </div>
  <% if (this.data.show): %>
    <span>Visible</span>
  <% endif; %>
</Define:TestComponent>`;

  const filename = 'test.jqhtml';

  try {
    // Parse and generate with sourcemap
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, source, filename);
    const ast = parser.parse();

    const generator = new CodeGenerator();
    const result = generator.generateWithSourceMap(ast, filename, source);

    console.log('Generated code with sourcemap');

    // Check if sourcemap was generated
    if (!result.source_map) {
      console.log(colors.red('❌ No sourcemap generated'));
      return;
    }

    // Parse the sourcemap
    const sourcemapObj = JSON.parse(result.source_map);
    console.log('\nSourcemap properties:');
    console.log(`  Version: ${sourcemapObj.version}`);
    console.log(`  Sources: ${JSON.stringify(sourcemapObj.sources)}`);
    console.log(`  Mappings length: ${sourcemapObj.mappings ? sourcemapObj.mappings.length : 0}`);

    // Check mappings
    if (!sourcemapObj.mappings || sourcemapObj.mappings === '') {
      console.log(colors.red('  ❌ No mappings found'));
    } else {
      // Count segments
      const segments = sourcemapObj.mappings.split(';');
      const nonEmpty = segments.filter(s => s !== '').length;
      console.log(`  Mapping segments: ${nonEmpty}/${segments.length} non-empty`);

      // Sample first few mappings
      console.log(`  First mappings: ${sourcemapObj.mappings.substring(0, 50)}...`);
    }

    // Test with SourceMapConsumer
    console.log('\n' + colors.bold('Testing mapping resolution:'));
    const consumer = await new SourceMapConsumer(sourcemapObj);

    // Test a few positions
    const testPositions = [
      { line: 1, column: 0 },
      { line: 5, column: 2 },
      { line: 10, column: 0 }
    ];

    for (const pos of testPositions) {
      const original = consumer.originalPositionFor(pos);
      if (original.source) {
        console.log(colors.green(`  ✅ Line ${pos.line}, Col ${pos.column} → Line ${original.line}, Col ${original.column}`));
      } else {
        console.log(colors.yellow(`  ⚠️  Line ${pos.line}, Col ${pos.column} → No mapping`));
      }
    }

    consumer.destroy();

    // Check inline sourcemap in component
    const component = result.components.get('TestComponent');
    if (component && component.render_function.includes('sourceMappingURL')) {
      console.log(colors.green('\n✅ Inline sourcemap added to render function'));

      // Extract and decode inline sourcemap
      const match = component.render_function.match(/sourceMappingURL=data:application\/json;base64,(.+)/);
      if (match) {
        const inlineMapJson = Buffer.from(match[1], 'base64').toString('utf8');
        const inlineMap = JSON.parse(inlineMapJson);
        console.log(`  Inline map has ${inlineMap.mappings ? inlineMap.mappings.length : 0} chars of mappings`);
      }
    }

    console.log(colors.green('\n✅ SourceMapGenerator integration working'));

  } catch (error) {
    console.log(colors.red(`❌ Error: ${error.message}`));
    console.error(error.stack);
  }
}

testSourceMapGeneration().catch(console.error);