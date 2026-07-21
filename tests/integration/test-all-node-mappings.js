#!/usr/bin/env node

/**
 * Comprehensive test for source map mappings of all node types
 */

import { Lexer, Parser, CodeGenerator } from './packages/parser/dist/index.js';

// Template with all node types
const testTemplate = `<%-- Test all node types for source mapping --%>
<Define:AllNodeTypes>
  <%-- HTML tags --%>
  <div class="container">
    <h1>Testing All Node Types</h1>
    <p id="text">Simple text content</p>

    <%-- Self-closing HTML tags --%>
    <img src="test.jpg" alt="Test" />
    <br />

    <%-- Expressions --%>
    <span>Value: <%= this.data.value %></span>
    <span>Complex: <%= this.data.items.length + 1 %></span>

    <%-- If statements --%>
    <% if (this.data.showSection): %>
      <section>Conditional content</section>
    <% endif; %>

    <% if (this.data.type === 'A'): %>
      <div>Type A</div>
    <% else: %>
      <div>Not Type A</div>
    <% endif; %>

    <%-- For loops --%>
    <% for (let i = 0; i < 3; i++): %>
      <li>Item <%= i %></li>
    <% endfor; %>

    <% for (const item of this.data.items || []): %>
      <span><%= item.name %></span>
    <% endfor; %>

    <%-- Code blocks --%>
    <%
      const localVar = 'test';
      const computed = this.data.value * 2;
      console.log('Code block executed');
    %>

    <%-- Component invocations --%>
    <SimpleComponent />

    <ComponentWithAttrs title="Test" $data-sid="123" />

    <%-- Component with children --%>
    <ParentComponent>
      <p>Child content</p>
      <NestedComponent />
    </ParentComponent>

    <%-- HTML comments (preserved) --%>
    <!-- This is an HTML comment -->

    <%-- Nested structures --%>
    <ul>
      <% for (let j = 0; j < 2; j++): %>
        <li>
          <% if (j === 0): %>
            <strong>First</strong>
          <% else: %>
            <em>Other</em>
          <% endif; %>
        </li>
      <% endfor; %>
    </ul>
  </div>
</Define:AllNodeTypes>`;

console.log('Testing Source Map Mappings for All Node Types\n');
console.log('=' .repeat(70));

try {
  // Parse the template
  const lexer = new Lexer(testTemplate);
  const tokens = lexer.tokenize();
  console.log(`✓ Lexer produced ${tokens.length} tokens`);

  const parser = new Parser(tokens, testTemplate, 'all-nodes.jqhtml');
  const ast = parser.parse();
  console.log(`✓ Parser created AST`);

  // Generate with position tracking
  const generator = new CodeGenerator();
  generator.setPositionTracking(true);
  const result = generator.generate(ast);
  console.log(`✓ Generated ${result.code.length} bytes of JavaScript`);

  // Generate with source map
  const resultWithMap = generator.generateWithSourceMap(ast, 'all-nodes.jqhtml', testTemplate);
  console.log(`✓ Generated code with source map`);

  // Analyze position log
  const positionLog = generator.getPositionLog();
  console.log(`\nPosition Tracking Results:`);
  console.log(`--------------------------`);
  console.log(`Total tracked positions: ${positionLog.length}`);

  // Count by node type
  const nodeTypes = {};
  positionLog.forEach(entry => {
    if (entry.node) {
      const type = entry.node.split(':')[0];
      nodeTypes[type] = (nodeTypes[type] || 0) + 1;
    }
  });

  console.log(`\nNode types tracked:`);
  Object.entries(nodeTypes).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`  • ${type}: ${count} positions`);
  });

  // Check for all expected node types
  console.log(`\nNode Type Coverage Check:`);
  const expectedTypes = [
    'Text',
    'Expression',
    'HtmlTag',
    'ComponentInvocation',
    'IfStatement',
    'ForStatement',
    'CodeBlock'
  ];

  expectedTypes.forEach(type => {
    const found = nodeTypes[type] || 0;
    const status = found > 0 ? '✅' : '❌';
    console.log(`  ${status} ${type}: ${found} mappings`);
  });

  // Analyze source map
  if (resultWithMap.source_map) {
    const sourceMap = JSON.parse(resultWithMap.source_map);
    console.log(`\nSource Map Analysis:`);
    console.log(`--------------------`);
    console.log(`Version: ${sourceMap.version}`);
    console.log(`Source files: ${sourceMap.sources.join(', ')}`);
    console.log(`Mappings encoded length: ${sourceMap.mappings.length} chars`);
    console.log(`Source content embedded: ${!!sourceMap.sourcesContent}`);
  }

  // Sample some tracked positions
  console.log(`\nSample Position Mappings:`);
  console.log(`-------------------------`);

  const samples = [
    { type: 'HtmlTag', description: 'HTML tag mapping' },
    { type: 'ComponentInvocation', description: 'Component invocation' },
    { type: 'IfStatement', description: 'If statement' },
    { type: 'ForStatement', description: 'For loop' },
    { type: 'CodeBlock', description: 'Code block' }
  ];

  samples.forEach(sample => {
    const entry = positionLog.find(e => e.node && e.node.startsWith(sample.type));
    if (entry) {
      console.log(`  ${sample.description}:`);
      console.log(`    Line ${entry.line}:${entry.column} - "${entry.text.substring(0, 40)}..."`);
      console.log(`    Maps from: ${entry.node}`);
    }
  });

  // Check generated code structure
  console.log(`\nGenerated Code Analysis:`);
  console.log(`------------------------`);
  const codeLines = result.code.split('\n');
  const stats = {
    totalLines: codeLines.length,
    outputStatements: codeLines.filter(l => l.includes('_output.push')).length,
    ifStatements: codeLines.filter(l => l.trim().startsWith('if (')).length,
    forLoops: codeLines.filter(l => l.includes('for (')).length,
    componentCalls: codeLines.filter(l => l.includes('{comp:')).length,
    tagCalls: codeLines.filter(l => l.includes('{tag:')).length
  };

  Object.entries(stats).forEach(([key, value]) => {
    console.log(`  • ${key}: ${value}`);
  });

  // Verify all features are working
  console.log(`\nFeature Verification:`);
  console.log(`---------------------`);
  const features = {
    'HTML tags tracked': nodeTypes['HtmlTag'] > 0,
    'Components tracked': nodeTypes['ComponentInvocation'] > 0,
    'Control flow tracked': (nodeTypes['IfStatement'] || 0) + (nodeTypes['ForStatement'] || 0) > 0,
    'Code blocks tracked': nodeTypes['CodeBlock'] > 0,
    'Text nodes tracked': nodeTypes['Text'] > 0,
    'Expressions tracked': nodeTypes['Expression'] > 0,
    'Source map generated': !!resultWithMap.source_map,
    'Position log populated': positionLog.length > 0
  };

  let allPassed = true;
  Object.entries(features).forEach(([feature, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${feature}`);
    if (!passed) allPassed = false;
  });

  if (allPassed) {
    console.log(`\n🎉 All node type mappings working correctly!`);
  } else {
    console.log(`\n⚠️ Some node types are not being tracked properly.`);
  }

} catch (error) {
  console.error(`\n❌ Test failed: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
}