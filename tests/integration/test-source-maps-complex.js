#!/usr/bin/env node

/**
 * Complex test for source map generation with control flow
 */

import { Lexer, Parser, CodeGenerator } from './packages/parser/dist/index.js';
import { SourceMapConsumer } from 'source-map';

// Complex template with control flow
const template = `<%-- This is a comment that should not appear in output --%>
<Define:ComplexComponent>
  <div class="container">
    <header>
      <h1><%= this.data.title %></h1>
      <% if (this.data.showSubtitle): %>
        <h2>Subtitle: <%= this.data.subtitle %></h2>
      <% endif; %>
    </header>

    <main>
      <ul>
        <% for (let i = 0; i < this.data.items.length; i++): %>
          <li>
            Item <%= i %>:
            <span><%= this.data.items[i] %></span>
            <% if (i === 0): %>
              <em>(first)</em>
            <% endif; %>
          </li>
        <% endfor; %>
      </ul>

      <% if (this.data.footer): %>
        <footer>
          <%= this.data.footer %>
        </footer>
      <% endif; %>
    </main>
  </div>
</Define:ComplexComponent>`;

const sourceFile = 'complex.jqhtml';

console.log('Testing complex source map generation...\n');
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

  console.log('Components generated:', Array.from(result.components.keys()).join(', '));
  console.log('Source map version:', sourceMap.version);
  console.log('Mappings string length:', sourceMap.mappings.length);

  // Use SourceMapConsumer to verify mappings
  SourceMapConsumer.with(result.source_map, null, async (consumer) => {
    console.log('\nVerifying source mappings:');
    console.log('--------------------------');

    // Count total mappings
    let mappingCount = 0;
    const mappings = [];

    consumer.eachMapping(mapping => {
      mappingCount++;
      if (mappingCount <= 10) {
        mappings.push({
          generated: `${mapping.generatedLine}:${mapping.generatedColumn}`,
          original: mapping.source ? `${mapping.originalLine}:${mapping.originalColumn}` : null,
          source: mapping.source
        });
      }
    });

    console.log(`Total mappings: ${mappingCount}`);
    console.log('\nFirst 10 mappings:');
    mappings.forEach((m, i) => {
      if (m.original) {
        console.log(`  ${i+1}. Generated ${m.generated} → Original ${m.original}`);
      }
    });

    // Test specific elements
    console.log('\nLooking for specific template elements in mappings:');

    const generatedLines = result.code.split('\n');
    const interestingLines = [];

    generatedLines.forEach((line, index) => {
      if (line.includes('_output.push') && !line.includes('_output.push(...')) {
        interestingLines.push({ line: index + 1, content: line.trim() });
      }
    });

    console.log(`Found ${interestingLines.length} output statements`);

    // Check first few output statements
    for (let i = 0; i < Math.min(5, interestingLines.length); i++) {
      const { line, content } = interestingLines[i];
      const pos = consumer.originalPositionFor({
        line: line,
        column: 0
      });

      if (pos.source) {
        const templateLine = template.split('\n')[pos.line - 1];
        console.log(`\n  Output at line ${line}: "${content.substring(0, 40)}..."`);
        console.log(`    Maps to template line ${pos.line}: "${templateLine?.trim()}"`);
      }
    }

    console.log('\n✅ Complex source map test completed successfully!');
  });

} catch (error) {
  console.error('❌ Error during complex source map test:', error.message);
  console.error(error.stack);
  process.exit(1);
}