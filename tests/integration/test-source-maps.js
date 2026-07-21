#!/usr/bin/env node

/**
 * Test source map generation in JQHTML CodeGenerator
 */

import { Lexer, Parser, CodeGenerator } from './packages/parser/dist/index.js';

// Simple test template
const template = `<Define:TestComponent>
  <div class="test">
    <h1>Hello World</h1>
    <p>The answer is <%= 42 %></p>
    <span>More text here</span>
  </div>
</Define:TestComponent>`;

const sourceFile = 'test.jqhtml';

console.log('Testing JQHTML source map generation...\n');
console.log('Input template:');
console.log('---------------');
console.log(template);
console.log('\n');

try {
  // Parse the template
  const lexer = new Lexer(template);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, template, sourceFile);
  const ast = parser.parse();

  // Create code generator
  const generator = new CodeGenerator();

  // Generate code with source map
  const result = generator.generateWithSourceMap(ast, sourceFile, template);

  console.log('Generated code (with source map URL):');
  console.log('--------------------------------------');
  console.log(result.code);
  console.log('\n');

  // Parse and display source map
  if (result.source_map) {
    const sourceMap = JSON.parse(result.source_map);

    console.log('Source map details:');
    console.log('-------------------');
    console.log(`Version: ${sourceMap.version}`);
    console.log(`Generated file: ${sourceMap.file}`);
    console.log(`Source files: ${sourceMap.sources.join(', ')}`);
    console.log(`Has source content: ${sourceMap.sourcesContent ? 'Yes' : 'No'}`);
    console.log(`Number of mappings: ${sourceMap.mappings ? sourceMap.mappings.length : 'encoded'}`);

    // Display data URI
    console.log('\nSource map data URI (first 100 chars):');
    console.log(result.source_map_data_uri?.substring(0, 100) + '...');

    // Check that source map has the template content
    if (sourceMap.sourcesContent) {
      console.log('\nSource content preserved in map: ' +
        (sourceMap.sourcesContent[0] === template ? '✅ Yes' : '❌ No'));
    }
  }

  console.log('\n✅ Source map generation test completed successfully!');

} catch (error) {
  console.error('❌ Error during source map generation test:', error.message);
  console.error(error.stack);
  process.exit(1);
}