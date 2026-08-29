#!/usr/bin/env node

/**
 * Regenerate the baseline for a SINGLE corpus file.
 *
 *   node test-regression/regenerate-one.js test-simple.jqhtml
 *
 * Baselines are the record of what the compiler is expected to produce, so they are
 * only ever updated deliberately, one fixture at a time, after the diff for that
 * fixture has been read and understood. Regenerating the whole set in one go would
 * bake in whatever the compiler happens to do today, including any regression that
 * has not been noticed yet - which is how the corpus drifted a full release behind
 * in the first place.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Lexer, Parser, CodeGenerator } from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = path.join(__dirname, '../test-corpus');
const BASELINE_DIR = path.join(__dirname, '../baseline-outputs');

const target = process.argv[2];
if (!target) {
  console.error('Usage: node test-regression/regenerate-one.js <file.jqhtml>');
  process.exit(1);
}

const filepath = path.join(CORPUS_DIR, target);
if (!fs.existsSync(filepath)) {
  console.error(`No such corpus file: ${filepath}`);
  process.exit(1);
}

function compileTemplate(source, filename) {
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, source, filename);
    const ast = parser.parse();
    const generator = new CodeGenerator();
    const result = generator.generate(ast);

    return {
      success: true,
      code: result.code,
      components: Array.from(result.components.entries()).map(([name, comp]) => ({
        name,
        render_function: comp.render_function,
        dependencies: comp.dependencies,
        tagName: comp.tagName,
        defaultAttributes: comp.defaultAttributes
      })),
      ast: JSON.stringify(ast, null, 2),
      tokens: tokens.map(t => ({ type: t.type, value: t.value, line: t.line, column: t.column }))
    };
  } catch (error) {
    return { success: false, error: error.message, stack: error.stack };
  }
}

const generateHash = content => crypto.createHash('md5').update(content).digest('hex');

const source = fs.readFileSync(filepath, 'utf-8');
const result = compileTemplate(source, target);

if (!result.success) {
  console.error(`Compilation failed for ${target}: ${result.error}`);
  process.exit(1);
}

result.codeHash = generateHash(result.code);
result.sourceHash = generateHash(source);

const outputName = target.replace('.jqhtml', '.baseline.json');
fs.writeFileSync(path.join(BASELINE_DIR, outputName), JSON.stringify(result, null, 2));
console.log(`Regenerated baseline: ${outputName} (codeHash ${result.codeHash.slice(0, 8)})`);
