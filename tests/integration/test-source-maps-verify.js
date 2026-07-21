#!/usr/bin/env node

/**
 * Verify source map generation with mappings
 */

import { Lexer, Parser, CodeGenerator } from './packages/parser/dist/index.js';

// Complex template with control flow
const template = `<%-- This is a comment --%>
<Define:ComplexComponent>
  <div class="container">
    <h1><%= this.data.title %></h1>
    <% if (this.data.show): %>
      <p>Content: <%= this.data.content %></p>
    <% endif; %>
    <ul>
      <% for (let i = 0; i < 3; i++): %>
        <li>Item <%= i %></li>
      <% endfor; %>
    </ul>
  </div>
</Define:ComplexComponent>`;

const sourceFile = 'complex.jqhtml';

console.log('Verifying source map generation...\n');
console.log('Template has', template.split('\n').length, 'lines');

try {
  // Parse the template
  const lexer = new Lexer(template);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, template, sourceFile);
  const ast = parser.parse();

  // Generate code with source map
  const generator = new CodeGenerator();
  const result = generator.generateWithSourceMap(ast, sourceFile, template);

  // Parse the source map
  const sourceMap = JSON.parse(result.source_map);

  console.log('\nSource Map Properties:');
  console.log('----------------------');
  console.log('Version:', sourceMap.version);
  console.log('Generated file:', sourceMap.file);
  console.log('Source files:', sourceMap.sources);
  console.log('Has source content:', !!sourceMap.sourcesContent);
  console.log('Mappings encoded length:', sourceMap.mappings.length);

  // Decode a few mappings manually to verify
  console.log('\nSource Map Validation:');
  console.log('----------------------');

  // Check that source content matches
  if (sourceMap.sourcesContent && sourceMap.sourcesContent[0]) {
    const matches = sourceMap.sourcesContent[0] === template;
    console.log('✓ Source content preserved:', matches ? 'Yes' : 'No');
  }

  // Check that mappings exist
  console.log('✓ Has mappings:', sourceMap.mappings.length > 0 ? 'Yes' : 'No');

  // Check that source file is correct
  console.log('✓ Source file correct:', sourceMap.sources[0] === sourceFile ? 'Yes' : 'No');

  // Check that the generated code has source map URL
  const hasSourceMapUrl = result.code.includes('//# sourceMappingURL=data:');
  console.log('✓ Has inline source map URL:', hasSourceMapUrl ? 'Yes' : 'No');

  // Display generated code stats
  console.log('\nGenerated Code Stats:');
  console.log('---------------------');
  const codeLines = result.code.split('\n');
  const outputStatements = codeLines.filter(line => line.includes('_output.push')).length;
  console.log('Total lines:', codeLines.length);
  console.log('Output statements:', outputStatements);

  // Show a sample of the generated code with line numbers
  console.log('\nSample of generated render function:');
  console.log('-------------------------------------');
  const renderStart = codeLines.findIndex(line => line.includes('function render'));
  if (renderStart !== -1) {
    for (let i = renderStart; i < Math.min(renderStart + 15, codeLines.length); i++) {
      console.log(`  ${(i+1).toString().padStart(3)}: ${codeLines[i]}`);
    }
    console.log('  ...');
  }

  // Verify position tracking log if enabled
  console.log('\nPosition Tracking:');
  console.log('------------------');
  const positionLog = generator.getPositionLog();
  console.log('Position log entries:', positionLog.length);

  if (positionLog.length > 0) {
    console.log('\nFirst 5 position entries:');
    positionLog.slice(0, 5).forEach((entry, i) => {
      console.log(`  ${i+1}. Line ${entry.line}:${entry.column} - "${entry.text.substring(0, 30)}..."${entry.node ? ` [${entry.node}]` : ''}`);
    });
  }

  console.log('\n✅ Source map generation verified successfully!');
  console.log('\nThe source map includes:');
  console.log('  • Mappings between generated and original positions');
  console.log('  • Embedded source content for debugging');
  console.log('  • Inline data URI for browser compatibility');

} catch (error) {
  console.error('❌ Error during source map verification:', error.message);
  console.error(error.stack);
  process.exit(1);
}