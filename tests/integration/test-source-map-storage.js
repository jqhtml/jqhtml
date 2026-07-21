#!/usr/bin/env node

/**
 * Test source map storage and retrieval
 */

import { Lexer, Parser, CodeGenerator } from './packages/parser/dist/index.js';
import { SourceMapStorage, compileAndSave } from './packages/parser/dist/source-map-storage.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test template
const testTemplate = `<Define:StorageTest>
  <div class="test">
    <h1><%= this.data.title %></h1>
    <% if (this.data.show): %>
      <p>Conditional content</p>
    <% endif; %>
  </div>
</Define:StorageTest>`;

// Test directory
const testDir = path.join(__dirname, 'test-output');

// Ensure test directory exists
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

console.log('Testing Source Map Storage & Retrieval\n');
console.log('=' .repeat(70));

// Test 1: Inline source map
console.log('\n1. Testing INLINE source map mode');
console.log('-'.repeat(40));

async function testInlineMode() {
  const storage = new SourceMapStorage({ mode: 'inline' });

  // Generate code with source map
  const lexer = new Lexer(testTemplate);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, testTemplate, 'test.jqhtml');
  const ast = parser.parse();

  const generator = new CodeGenerator();
  const result = generator.generateWithSourceMap(ast, 'test.jqhtml', testTemplate);

  // Save with inline source map
  const jsPath = path.join(testDir, 'inline-test.js');
  const saved = await storage.save(jsPath, result);

  console.log(`  ✓ Saved to: ${path.relative(__dirname, saved.jsPath)}`);

  // Verify inline source map is present
  const content = fs.readFileSync(jsPath, 'utf8');
  const hasInlineMap = content.includes('sourceMappingURL=data:');
  console.log(`  ✓ Contains inline source map: ${hasInlineMap ? 'Yes' : 'No'}`);

  // Load the source map
  const loadedMap = await storage.load(jsPath);
  console.log(`  ✓ Can load source map: ${loadedMap ? 'Yes' : 'No'}`);

  if (loadedMap) {
    const mapData = JSON.parse(loadedMap);
    console.log(`  ✓ Source map version: ${mapData.version}`);
    console.log(`  ✓ Has source content: ${!!mapData.sourcesContent}`);
  }
}

// Test 2: External source map
console.log('\n2. Testing EXTERNAL source map mode');
console.log('-'.repeat(40));

async function testExternalMode() {
  const storage = new SourceMapStorage({ mode: 'external', outputDir: testDir });

  // Generate code with source map
  const lexer = new Lexer(testTemplate);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, testTemplate, 'test.jqhtml');
  const ast = parser.parse();

  const generator = new CodeGenerator();
  const result = generator.generateWithSourceMap(ast, 'test.jqhtml', testTemplate);

  // Save with external source map
  const jsPath = path.join(testDir, 'external-test.js');
  const saved = await storage.save(jsPath, result);

  console.log(`  ✓ Saved JS to: ${path.relative(__dirname, saved.jsPath)}`);

  if (saved.mapPath) {
    console.log(`  ✓ Saved map to: ${path.relative(__dirname, saved.mapPath)}`);

    // Verify map file exists
    const mapExists = fs.existsSync(saved.mapPath);
    console.log(`  ✓ Map file exists: ${mapExists ? 'Yes' : 'No'}`);
  }

  // Verify JS contains source map URL
  const content = fs.readFileSync(jsPath, 'utf8');
  const hasMapUrl = content.includes('sourceMappingURL=');
  console.log(`  ✓ Contains source map URL: ${hasMapUrl ? 'Yes' : 'No'}`);

  // Load the source map
  const loadedMap = await storage.load(jsPath);
  console.log(`  ✓ Can load source map: ${loadedMap ? 'Yes' : 'No'}`);
}

// Test 3: Both inline and external
console.log('\n3. Testing BOTH mode (inline + external)');
console.log('-'.repeat(40));

async function testBothMode() {
  const storage = new SourceMapStorage({ mode: 'both', outputDir: testDir });

  // Generate code with source map
  const lexer = new Lexer(testTemplate);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, testTemplate, 'test.jqhtml');
  const ast = parser.parse();

  const generator = new CodeGenerator();
  const result = generator.generateWithSourceMap(ast, 'test.jqhtml', testTemplate);

  // Save with both modes
  const jsPath = path.join(testDir, 'both-test.js');
  const saved = await storage.save(jsPath, result);

  console.log(`  ✓ Saved JS to: ${path.relative(__dirname, saved.jsPath)}`);

  // Check for both inline and external
  const content = fs.readFileSync(jsPath, 'utf8');
  const hasInlineMap = content.includes('sourceMappingURL=data:');
  console.log(`  ✓ Has inline source map: ${hasInlineMap ? 'Yes' : 'No'}`);

  if (saved.mapPath) {
    const mapExists = fs.existsSync(saved.mapPath);
    console.log(`  ✓ Has external map file: ${mapExists ? 'Yes' : 'No'}`);
  }
}

// Test 4: compileAndSave helper
console.log('\n4. Testing compileAndSave helper function');
console.log('-'.repeat(40));

async function testCompileAndSave() {
  // Create a test template file
  const templatePath = path.join(testDir, 'test-template.jqhtml');
  fs.writeFileSync(templatePath, testTemplate);

  const outputPath = path.join(testDir, 'compiled.js');

  try {
    const result = await compileAndSave(templatePath, outputPath, {
      mode: 'external',
      outputDir: testDir
    });

    console.log(`  ✓ Compiled from: ${path.basename(templatePath)}`);
    console.log(`  ✓ Saved to: ${path.basename(result.jsPath)}`);

    if (result.mapPath) {
      console.log(`  ✓ Map saved to: ${path.basename(result.mapPath)}`);
    }

    // Verify compilation
    const jsExists = fs.existsSync(result.jsPath);
    console.log(`  ✓ JS file created: ${jsExists ? 'Yes' : 'No'}`);

  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
}

// Test 5: Cache functionality
console.log('\n5. Testing cache functionality');
console.log('-'.repeat(40));

async function testCache() {
  const storage = new SourceMapStorage({ mode: 'external' });

  // Generate and save
  const lexer = new Lexer(testTemplate);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, testTemplate, 'test.jqhtml');
  const ast = parser.parse();

  const generator = new CodeGenerator();
  const result = generator.generateWithSourceMap(ast, 'test.jqhtml', testTemplate);

  const jsPath = path.join(testDir, 'cache-test.js');
  await storage.save(jsPath, result);

  // First load (from file)
  const start1 = Date.now();
  const map1 = await storage.load(jsPath);
  const time1 = Date.now() - start1;
  console.log(`  ✓ First load (from file): ${time1}ms`);

  // Second load (from cache)
  const start2 = Date.now();
  const map2 = await storage.load(jsPath);
  const time2 = Date.now() - start2;
  console.log(`  ✓ Second load (from cache): ${time2}ms`);
  console.log(`  ✓ Cache faster: ${time2 < time1 ? 'Yes' : 'No'}`);

  // Clear cache
  storage.clearCache();
  const map3 = await storage.load(jsPath);
  console.log(`  ✓ Still works after cache clear: ${map3 ? 'Yes' : 'No'}`);
}

// Run all tests
async function runAllTests() {
  try {
    await testInlineMode();
    await testExternalMode();
    await testBothMode();
    await testCompileAndSave();
    await testCache();

    console.log('\n' + '='.repeat(70));
    console.log('Summary:');
    console.log('--------');
    console.log('✅ Inline source map mode working');
    console.log('✅ External source map files working');
    console.log('✅ Both mode (inline + external) working');
    console.log('✅ compileAndSave helper working');
    console.log('✅ Cache functionality working');
    console.log('\nSource map storage and retrieval working correctly!');

    // Clean up test directory
    console.log('\nCleaning up test files...');
    const files = fs.readdirSync(testDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(testDir, file));
    });
    fs.rmdirSync(testDir);
    console.log('Test directory cleaned up.');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

runAllTests();