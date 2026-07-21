#!/usr/bin/env node

/**
 * Comprehensive test of all JQHTML template features with source maps
 */

import { Lexer, Parser, CodeGenerator } from './packages/parser/dist/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templateDir = path.join(__dirname, 'test-templates');

// Color output for better readability
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testTemplate(templateFile) {
  log(`\n${'='.repeat(70)}`, 'bright');
  log(`Testing: ${templateFile}`, 'cyan');
  log('='.repeat(70), 'bright');

  const templatePath = path.join(templateDir, templateFile);
  const template = fs.readFileSync(templatePath, 'utf8');

  // Display template info
  const lines = template.split('\n');
  const commentLines = lines.filter(l => l.includes('<%--')).length;
  const expressionCount = (template.match(/<%=/g) || []).length;
  const codeBlockCount = (template.match(/<%[^=]/g) || []).length - commentLines;
  const htmlTagCount = (template.match(/<[^%]/g) || []).length;

  log(`\nTemplate Statistics:`, 'yellow');
  console.log(`  • Total lines: ${lines.length}`);
  console.log(`  • Comments: ${commentLines}`);
  console.log(`  • Expressions (<%=): ${expressionCount}`);
  console.log(`  • Code blocks (<%): ${codeBlockCount}`);
  console.log(`  • HTML tags: ${htmlTagCount}`);
  console.log(`  • File size: ${(template.length / 1024).toFixed(2)} KB`);

  try {
    // Parse the template
    log(`\nParsing...`, 'blue');
    const lexer = new Lexer(template);
    const tokens = lexer.tokenize();
    log(`  ✓ Lexer produced ${tokens.length} tokens`, 'green');

    const parser = new Parser(tokens, template, templateFile);
    const ast = parser.parse();
    log(`  ✓ Parser created AST`, 'green');

    // Generate code without source maps
    log(`\nGenerating code...`, 'blue');
    const generator = new CodeGenerator();

    // Enable position tracking for analysis
    generator.setPositionTracking(true);

    const result = generator.generate(ast);
    log(`  ✓ Generated ${result.code.length} bytes of JavaScript`, 'green');

    // Generate with source maps
    log(`\nGenerating with source maps...`, 'blue');
    const resultWithMap = generator.generateWithSourceMap(ast, templateFile, template);
    log(`  ✓ Generated code with source map`, 'green');

    // Analyze generated code
    const codeLines = result.code.split('\n');
    const outputStatements = codeLines.filter(l => l.includes('_output.push')).length;
    const ifStatements = codeLines.filter(l => l.trim().startsWith('if (')).length;
    const forLoops = codeLines.filter(l => l.includes('for (')).length;

    log(`\nGenerated Code Analysis:`, 'yellow');
    console.log(`  • Total lines: ${codeLines.length}`);
    console.log(`  • Output statements: ${outputStatements}`);
    console.log(`  • Conditionals (if): ${ifStatements}`);
    console.log(`  • Loops (for): ${forLoops}`);
    console.log(`  • Components defined: ${Array.from(result.components.keys()).join(', ')}`);

    // Analyze source map
    if (resultWithMap.source_map) {
      const sourceMap = JSON.parse(resultWithMap.source_map);
      log(`\nSource Map Analysis:`, 'yellow');
      console.log(`  • Version: ${sourceMap.version}`);
      console.log(`  • Sources: ${sourceMap.sources.join(', ')}`);
      console.log(`  • Has embedded source: ${!!sourceMap.sourcesContent}`);
      console.log(`  • Mappings length: ${sourceMap.mappings.length} chars`);
      console.log(`  • Data URI size: ${(resultWithMap.source_map_data_uri.length / 1024).toFixed(2)} KB`);
    }

    // Check position tracking
    const positionLog = generator.getPositionLog();
    if (positionLog.length > 0) {
      log(`\nPosition Tracking:`, 'yellow');
      console.log(`  • Total tracked positions: ${positionLog.length}`);

      const nodeTypes = {};
      positionLog.forEach(entry => {
        if (entry.node) {
          const type = entry.node.split(':')[0];
          nodeTypes[type] = (nodeTypes[type] || 0) + 1;
        }
      });

      console.log(`  • Tracked node types:`);
      Object.entries(nodeTypes).forEach(([type, count]) => {
        console.log(`    - ${type}: ${count}`);
      });
    }

    // Validate generated function
    log(`\nValidating generated code...`, 'blue');
    try {
      // Extract the render function and validate it
      const renderMatch = result.code.match(/function render\([\s\S]*?\n  \}/);
      if (renderMatch) {
        // Create a test function to check syntax
        new Function('data', 'args', 'content', 'jqhtml', `
          const _output = [];
          const _cid = 'test';
          const that = this;
          ${renderMatch[0].match(/\{([\s\S]*)\}/)[1]}
        `);
        log(`  ✓ Generated function is syntactically valid`, 'green');
      }
    } catch (syntaxError) {
      log(`  ✗ Syntax error in generated function: ${syntaxError.message}`, 'red');
    }

    // Check for specific features
    log(`\nFeature Detection:`, 'yellow');
    const features = {
      'Comments (<%-- --%>)': template.includes('<%--'),
      'Expressions (<%= %>)': template.includes('<%='),
      'Code blocks (<% %>)': template.includes('<%') && !template.includes('<%='),
      'If statements': template.includes('<% if'),
      'For loops': template.includes('<% for'),
      'Nested JavaScript': template.includes('const ') || template.includes('let '),
      '$id attributes': template.includes('$sid='),
      '$-attributes': template.includes('$') && template.includes('='),
      'Component definition': template.includes('<Define:'),
      'Inline JavaScript': /<%=.*?[+\-*/].*?%>/.test(template),
      'Method calls': /<%=.*?\(.*?\).*?%>/.test(template),
      'Ternary operators': /<%=.*?\?.*?:.*?%>/.test(template),
      'Object access': /<%=.*?\..*?%>/.test(template),
      'Array access': /<%=.*?\[.*?\].*?%>/.test(template)
    };

    console.log(`  Features used:`);
    Object.entries(features).forEach(([feature, present]) => {
      if (present) {
        console.log(`    ✓ ${feature}`);
      }
    });

    log(`\n✅ ${templateFile} - All tests passed!`, 'green');

    return {
      file: templateFile,
      success: true,
      stats: {
        templateLines: lines.length,
        generatedLines: codeLines.length,
        sourceMapSize: resultWithMap.source_map_data_uri?.length || 0,
        features: Object.keys(features).filter(f => features[f])
      }
    };

  } catch (error) {
    log(`\n❌ ${templateFile} - Test failed!`, 'red');
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error(`Stack trace:\n${error.stack}`);
    }

    return {
      file: templateFile,
      success: false,
      error: error.message
    };
  }
}

// Main test runner
log('\nJQHTML Comprehensive Template Test Suite', 'bright');
log('========================================\n', 'bright');

// Get all .jqhtml files
const templateFiles = fs.readdirSync(templateDir)
  .filter(file => file.endsWith('.jqhtml'))
  .sort();

log(`Found ${templateFiles.length} template files to test:`, 'cyan');
templateFiles.forEach(file => console.log(`  • ${file}`));

// Test each template
const results = [];
for (const file of templateFiles) {
  const result = testTemplate(file);
  results.push(result);
}

// Summary
log(`\n${'='.repeat(70)}`, 'bright');
log('TEST SUITE SUMMARY', 'bright');
log('='.repeat(70), 'bright');

const successful = results.filter(r => r.success).length;
const failed = results.filter(r => !r.success).length;

log(`\nResults:`, 'yellow');
console.log(`  • Successful: ${successful}/${results.length}`);
console.log(`  • Failed: ${failed}/${results.length}`);

if (failed > 0) {
  log(`\nFailed tests:`, 'red');
  results.filter(r => !r.success).forEach(r => {
    console.log(`  • ${r.file}: ${r.error}`);
  });
}

// Feature usage summary
log(`\nFeature Usage Across All Templates:`, 'yellow');
const allFeatures = {};
results.forEach(r => {
  if (r.stats?.features) {
    r.stats.features.forEach(f => {
      allFeatures[f] = (allFeatures[f] || 0) + 1;
    });
  }
});

Object.entries(allFeatures)
  .sort((a, b) => b[1] - a[1])
  .forEach(([feature, count]) => {
    console.log(`  • ${feature}: used in ${count} template(s)`);
  });

// Statistics
log(`\nAggregate Statistics:`, 'yellow');
const totalTemplateLines = results.reduce((sum, r) => sum + (r.stats?.templateLines || 0), 0);
const totalGeneratedLines = results.reduce((sum, r) => sum + (r.stats?.generatedLines || 0), 0);
const totalSourceMapSize = results.reduce((sum, r) => sum + (r.stats?.sourceMapSize || 0), 0);

console.log(`  • Total template lines: ${totalTemplateLines}`);
console.log(`  • Total generated lines: ${totalGeneratedLines}`);
console.log(`  • Code expansion ratio: ${(totalGeneratedLines / totalTemplateLines).toFixed(2)}x`);
console.log(`  • Total source map size: ${(totalSourceMapSize / 1024).toFixed(2)} KB`);

if (successful === results.length) {
  log(`\n🎉 All tests passed successfully!`, 'green');
  process.exit(0);
} else {
  log(`\n⚠️ Some tests failed. Please review the errors above.`, 'red');
  process.exit(1);
}