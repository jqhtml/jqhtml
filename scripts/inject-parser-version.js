#!/usr/bin/env node

/**
 * Script to inject the parser version into compiled TypeScript files
 * Replaces __PARSER_VERSION__ placeholder with actual version from package.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get parser package.json
const parserPackagePath = path.join(__dirname, '..', 'packages', 'parser', 'package.json');
const parserPackage = JSON.parse(fs.readFileSync(parserPackagePath, 'utf-8'));
const version = parserPackage.version;

console.log(`Injecting parser version: ${version}`);

// Files to process
const filesToProcess = [
  path.join(__dirname, '..', 'packages', 'parser', 'dist', 'codegen.js'),
  path.join(__dirname, '..', 'packages', 'parser', 'dist', 'codegen.cjs'),
  path.join(__dirname, '..', 'packages', 'parser', 'lib', 'codegen.js'),
];

// Process each file
filesToProcess.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    console.log(`Processing: ${filePath}`);

    let content = fs.readFileSync(filePath, 'utf-8');

    // Replace the placeholder
    const updatedContent = content.replace(/__PARSER_VERSION__/g, version);

    if (content !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf-8');
      console.log(`  ✓ Updated version to ${version}`);
    } else {
      console.log(`  - No placeholder found`);
    }
  } else {
    console.log(`  ⚠ File not found: ${filePath}`);
  }
});

console.log('Version injection complete!');