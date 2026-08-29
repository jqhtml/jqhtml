#!/usr/bin/env node

import { parse, generate_with_source_map, Lexer } from '../packages/parser/dist/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// VLQ decoder for sourcemap
function decodeVLQ(encoded) {
  const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const charToValue = {};
  for (let i = 0; i < BASE64_CHARS.length; i++) {
    charToValue[BASE64_CHARS[i]] = i;
  }

  const results = [];
  let index = 0;

  while (index < encoded.length) {
    let value = 0;
    let shift = 0;
    let continuation = true;

    while (continuation && index < encoded.length) {
      const digit = charToValue[encoded[index++]];
      if (digit === undefined) break;
      continuation = (digit & 0x20) !== 0;
      value |= (digit & 0x1f) << shift;
      shift += 5;
    }

    // Convert from VLQ to signed integer
    const shouldNegate = (value & 1) === 1;
    value >>>= 1;
    if (shouldNegate) {
      value = -value;
    }

    results.push(value);
  }

  return results;
}

function analyzeSourceMapMappings(inputFile) {
  console.log('\n' + '═'.repeat(80));
  console.log('                    SOURCEMAP LINE MAPPING ANALYZER');
  console.log('═'.repeat(80) + '\n');

  // Read input
  const inputPath = path.resolve(inputFile);
  const input = fs.readFileSync(inputPath, 'utf-8');
  const inputLines = input.split('\n');

  // Compile
  console.log('📂 Input file: ' + inputFile);
  console.log('🔧 Compiling JQHTML template...\n');

  const ast = parse(input);
  const result = generate_with_source_map(ast, {
    source_file: inputFile,
    source_content: input,
    inline_source_map: true
  });

  const outputLines = result.code.split('\n');

  // Extract and decode sourcemap
  const match = result.code.match(/sourceMappingURL=data:application\/json;base64,(.+)/);
  if (!match) {
    console.error('❌ No inline sourcemap found!');
    return;
  }

  const sourcemap = JSON.parse(Buffer.from(match[1], 'base64').toString());
  const mappings = sourcemap.mappings.split(';');

  // Decode the mappings to get actual source line numbers
  let currentSourceLine = 0;
  const outputToSource = new Map();

  for (let genLine = 0; genLine < mappings.length; genLine++) {
    const segment = mappings[genLine];
    if (!segment) continue;

    const values = decodeVLQ(segment);
    if (values.length >= 3) {
      // values[2] is the source line delta
      currentSourceLine += values[2];
      outputToSource.set(genLine + 1, currentSourceLine + 1);
    }
  }

  // Create source to output mapping
  const sourceToOutput = new Map();
  for (const [outLine, srcLine] of outputToSource.entries()) {
    if (!sourceToOutput.has(srcLine)) {
      sourceToOutput.set(srcLine, []);
    }
    sourceToOutput.get(srcLine).push(outLine);
  }

  // First, preprocess the input to show comment replacement
  const lexer = new Lexer(input);
  const processedInput = lexer.input; // This has comments replaced with spaces
  const processedLines = processedInput.split('\n');

  console.log('─'.repeat(180));
  console.log('SOURCE → PREPROCESSED → OUTPUT LINE MAPPING');
  console.log('─'.repeat(180));
  console.log('Src # │ Source Line                      │ Pre # │ Preprocessed (· = space)        │ Out # │ Generated Output');
  console.log('──────┼──────────────────────────────────┼───────┼──────────────────────────────────┼───────┼' + '─'.repeat(50));

  // Show ALL input lines and their transformations
  for (let i = 0; i < inputLines.length; i++) {
    const srcLine = i + 1;
    const inputContent = inputLines[i].substring(0, 34).padEnd(34);

    // Show preprocessed version with dots for spaces to make them visible
    const processedLine = processedLines[i] || '';
    const processedDisplay = processedLine
      .replace(/ /g, '·')  // Replace spaces with dots for visibility
      .substring(0, 34)
      .padEnd(34);

    const mappedOutputLines = sourceToOutput.get(srcLine) || [];

    if (mappedOutputLines.length > 0) {
      // Show first output line this input maps to
      const outLine = mappedOutputLines[0] + 1;
      const outputContent = outputLines[outLine - 1] ? outputLines[outLine - 1].substring(0, 50) : '';

      console.log(
        `${String(srcLine).padStart(5)} │ ${inputContent} │ ${String(srcLine).padStart(5)} │ ${processedDisplay} │ ${String(outLine).padStart(5)} │ ${outputContent}`
      );

      // If there are multiple output lines for this input, show them too
      for (let j = 1; j < Math.min(2, mappedOutputLines.length); j++) {
        const additionalOutLine = mappedOutputLines[j] + 1;
        const additionalOutputContent = outputLines[additionalOutLine - 1] ? outputLines[additionalOutLine - 1].substring(0, 50) : '';
        console.log(
          `${' '.repeat(5)} │ ${' '.repeat(34)} │ ${' '.repeat(5)} │ ${' '.repeat(34)} │ ${String(additionalOutLine).padStart(5)} │ ${additionalOutputContent}`
        );
      }
      if (mappedOutputLines.length > 2) {
        console.log(
          `${' '.repeat(5)} │ ${' '.repeat(34)} │ ${' '.repeat(5)} │ ${' '.repeat(34)} │ ${' '.repeat(5)} │ (... +${mappedOutputLines.length - 2} more)`
        );
      }
    } else {
      // Input line not mapped to any output
      console.log(
        `${String(srcLine).padStart(5)} │ ${inputContent} │ ${String(srcLine).padStart(5)} │ ${processedDisplay} │ ${' '.repeat(5)} │ (not in sourcemap)`
      );
    }
  }

  console.log('\n' + '═'.repeat(120));
  console.log('INSIGHTS');
  console.log('═'.repeat(120));

  // Calculate and show statistics
  console.log('\n' + '═'.repeat(80));
  console.log('STATISTICS');
  console.log('═'.repeat(80));

  const mappedInputLines = new Set();
  for (const srcLine of sourceToOutput.keys()) {
    mappedInputLines.add(srcLine);
  }

  console.log(`📊 Input lines: ${inputLines.length}`);
  console.log(`📊 Output lines: ${outputLines.length}`);
  console.log(`📊 Mapped input lines: ${mappedInputLines.size}/${inputLines.length}`);
  console.log(`📊 Mapped output lines: ${outputToSource.size}/${outputLines.length}`);

  // Find the render function line for offset verification
  let renderLine = -1;
  for (let i = 0; i < outputLines.length; i++) {
    if (outputLines[i].includes('render: function render(')) {
      renderLine = i + 1;
      break;
    }
  }

  if (renderLine > 0) {
    const calculatedOffset = -(renderLine - 2);
    console.log(`\n🔍 Render function found on output line: ${renderLine}`);
    console.log(`📐 Calculated offset: ${calculatedOffset}`);

    // Test the offset with a few examples
    console.log('\n' + '─'.repeat(80));
    console.log('OFFSET VERIFICATION');
    console.log('─'.repeat(80));
    console.log('Testing if offset aligns output to input correctly:');

    for (let testLine = renderLine + 1; testLine <= renderLine + 5 && testLine <= outputLines.length; testLine++) {
      const expectedSource = testLine + calculatedOffset;
      const actualSource = outputToSource.get(testLine);
      const match = actualSource === expectedSource ? '✅' : '❌';

      console.log(`  Output line ${testLine} + offset ${calculatedOffset} = ${expectedSource}, ` +
                  `Sourcemap says: ${actualSource || 'none'} ${match}`);
    }
  }

  // Find specific patterns to verify mapping
  console.log('\n' + '─'.repeat(80));
  console.log('KEY ELEMENT TRACKING');
  console.log('─'.repeat(80));

  const patterns = [
    { name: 'Define statement', pattern: /<Define:/ },
    { name: 'First div', pattern: /<div/ },
    { name: 'Script blocks', pattern: /<% / },
    { name: 'Script tags', pattern: /<script>/ },
    { name: 'Comments', pattern: /<%--/ }
  ];

  for (const { name, pattern } of patterns) {
    console.log(`\n🔍 ${name}:`);

    for (let i = 0; i < inputLines.length; i++) {
      if (pattern.test(inputLines[i])) {
        const srcLine = i + 1;
        const outLines = sourceToOutput.get(srcLine) || [];
        console.log(`  Input line ${srcLine}: "${inputLines[i].trim().substring(0, 40)}"`);
        if (outLines.length > 0) {
          console.log(`    ↳ Maps to output line(s): ${outLines.join(', ')}`);
        } else {
          console.log(`    ↳ Not mapped in output`);
        }
      }
    }
  }
}

// Add missing padCenter method for strings
String.prototype.padCenter = function(len) {
  const str = String(this);
  const padLeft = Math.floor((len - str.length) / 2);
  const padRight = len - str.length - padLeft;
  return ' '.repeat(Math.max(0, padLeft)) + str + ' '.repeat(Math.max(0, padRight));
};

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  // Create a default test file if none provided
  const defaultContent = `<Define:TestComponent>
  <div class="container">
    <h1>Test Component</h1>

    <% function testFunction() { %>
      <p>Inside test function</p>
    <% } %>

    <% testFunction(); %>

    <button @click=this.handleClick>
      Click Me
    </button>

    <script>
      function handleClick() {
        console.log('Button clicked');
        testError(); // This will error
      }
    </script>
  </div>
</Define:TestComponent>`;

  const defaultFile = 'test-baseline.jqhtml';
  fs.writeFileSync(defaultFile, defaultContent);
  console.log(`Created default test file: ${defaultFile}\n`);
  analyzeSourceMapMappings(defaultFile);
} else {
  analyzeSourceMapMappings(args[0]);
}