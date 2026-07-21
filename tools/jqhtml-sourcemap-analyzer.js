#!/usr/bin/env node

/**
 * JQHTML Sourcemap Analyzer
 * =========================
 *
 * Analyzes JavaScript files with inline or external sourcemaps to provide
 * insights about mapping quality, validation, and debugging information.
 *
 * USAGE:
 * node tools/jqhtml-sourcemap-analyzer.js <file.js>
 *
 * FEATURES:
 * - Extracts inline sourcemaps from JS files
 * - Validates sourcemap structure and VLQ mappings
 * - Shows mapping coverage statistics
 * - Tests specific line mappings
 * - Provides debugging insights
 */

import fs from 'fs';
import path from 'path';
import { SourceMapConsumer } from 'source-map';
import chalk from 'chalk';

// Check command line arguments
const jsFile = process.argv[2];
if (!jsFile) {
  console.error('Usage: node jqhtml-sourcemap-analyzer.js <file.js>');
  process.exit(1);
}

if (!fs.existsSync(jsFile)) {
  console.error(`Error: File not found: ${jsFile}`);
  process.exit(1);
}

// Read the JavaScript file
const jsContent = fs.readFileSync(jsFile, 'utf8');
const jsLines = jsContent.split('\n');

console.log(chalk.cyan('═'.repeat(80)));
console.log(chalk.cyan.bold('                    JQHTML SOURCEMAP ANALYZER'));
console.log(chalk.cyan('═'.repeat(80)));
console.log();

console.log(chalk.gray('File:'), jsFile);
console.log(chalk.gray('Lines:'), jsLines.length);
console.log();

// Extract sourcemap
function extractSourceMap(content) {
  // Look for inline sourcemap
  const inlineMatch = content.match(/\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,(.+)/);
  if (inlineMatch) {
    try {
      const base64Data = inlineMatch[1].trim();
      const decoded = Buffer.from(base64Data, 'base64').toString('utf8');
      return { type: 'inline', data: JSON.parse(decoded) };
    } catch (e) {
      return { type: 'inline', error: e.message };
    }
  }

  // Look for external sourcemap reference
  const externalMatch = content.match(/\/\/# sourceMappingURL=(.+)/);
  if (externalMatch) {
    const mapFile = path.resolve(path.dirname(jsFile), externalMatch[1].trim());
    if (fs.existsSync(mapFile)) {
      try {
        const mapContent = fs.readFileSync(mapFile, 'utf8');
        return { type: 'external', file: mapFile, data: JSON.parse(mapContent) };
      } catch (e) {
        return { type: 'external', file: mapFile, error: e.message };
      }
    } else {
      return { type: 'external', file: mapFile, error: 'File not found' };
    }
  }

  return { type: 'none' };
}

const sourcemap = extractSourceMap(jsContent);

// Report sourcemap status
console.log(chalk.yellow('▶ Sourcemap Detection'));
console.log(chalk.gray('─'.repeat(40)));

if (sourcemap.type === 'none') {
  console.log(chalk.red('✗'), 'No sourcemap found');
  process.exit(0);
} else if (sourcemap.error) {
  console.log(chalk.red('✗'), `Sourcemap ${sourcemap.type} but failed to parse:`, sourcemap.error);
  process.exit(1);
} else {
  console.log(chalk.green('✓'), `Sourcemap type: ${chalk.bold(sourcemap.type)}`);
  if (sourcemap.file) {
    console.log(chalk.gray('  File:'), sourcemap.file);
  }
}

console.log();

// Validate sourcemap structure
console.log(chalk.yellow('▶ Sourcemap Structure'));
console.log(chalk.gray('─'.repeat(40)));

const requiredFields = ['version', 'sources', 'mappings'];
const optionalFields = ['file', 'sourcesContent', 'names', 'sourceRoot'];

let isValid = true;

for (const field of requiredFields) {
  if (field in sourcemap.data) {
    console.log(chalk.green('✓'), `${field}:`,
      typeof sourcemap.data[field] === 'string'
        ? sourcemap.data[field].substring(0, 50) + (sourcemap.data[field].length > 50 ? '...' : '')
        : Array.isArray(sourcemap.data[field])
          ? `[${sourcemap.data[field].length} items]`
          : sourcemap.data[field]
    );
  } else {
    console.log(chalk.red('✗'), `${field}: MISSING (required)`);
    isValid = false;
  }
}

for (const field of optionalFields) {
  if (field in sourcemap.data) {
    console.log(chalk.gray('○'), `${field}:`,
      typeof sourcemap.data[field] === 'string'
        ? sourcemap.data[field].substring(0, 50) + (sourcemap.data[field].length > 50 ? '...' : '')
        : Array.isArray(sourcemap.data[field])
          ? `[${sourcemap.data[field].length} items]`
          : sourcemap.data[field]
    );
  }
}

if (!isValid) {
  console.log();
  console.log(chalk.red('✗'), 'Sourcemap is missing required fields');
  process.exit(1);
}

console.log();

// Analyze mappings using SourceMapConsumer
async function analyzeMappings() {
  console.log(chalk.yellow('▶ Mapping Analysis'));
  console.log(chalk.gray('─'.repeat(40)));

  try {
    await SourceMapConsumer.with(sourcemap.data, null, consumer => {
      // Count mappings
      const mappingSegments = sourcemap.data.mappings.split(';');
      const nonEmptySegments = mappingSegments.filter(s => s.length > 0);

      console.log('Total output lines:', chalk.bold(mappingSegments.length));
      console.log('Mapped output lines:', chalk.bold(nonEmptySegments.length));
      console.log('Coverage:', chalk.bold(((nonEmptySegments.length / mappingSegments.length) * 100).toFixed(1) + '%'));
      console.log();

      // Collect all mappings
      const mappings = [];
      consumer.eachMapping(m => mappings.push(m));

      console.log('Total mappings:', chalk.bold(mappings.length));

      if (mappings.length > 0) {
        // Find range of mapped lines
        const outputLines = mappings.map(m => m.generatedLine);
        const sourceLines = mappings.filter(m => m.source).map(m => m.originalLine);

        console.log('Output line range:', chalk.bold(`${Math.min(...outputLines)}-${Math.max(...outputLines)}`));
        if (sourceLines.length > 0) {
          console.log('Source line range:', chalk.bold(`${Math.min(...sourceLines)}-${Math.max(...sourceLines)}`));
        }
      }

      console.log();

      // Test specific problematic lines
      console.log(chalk.yellow('▶ Line Mapping Tests'));
      console.log(chalk.gray('─'.repeat(40)));

      // Find lines with potential errors (containing common error triggers)
      const errorPatterns = [
        { pattern: /undefined|null|error|throw|catch/i, name: 'Error-related' },
        { pattern: /foobar|test|TODO|FIXME/i, name: 'Test/Debug' },
        { pattern: /console\.(log|error|warn)/i, name: 'Console' }
      ];

      let foundTestableLines = false;

      jsLines.forEach((line, index) => {
        const lineNum = index + 1;
        for (const { pattern, name } of errorPatterns) {
          if (pattern.test(line)) {
            foundTestableLines = true;
            const pos = consumer.originalPositionFor({ line: lineNum, column: 0 });

            if (pos.source) {
              console.log(chalk.green('✓'), `Line ${lineNum} (${name}):`);
              console.log('  ', chalk.gray('→'), `${path.basename(pos.source)}:${pos.line}:${pos.column}`);
              if (pos.name) {
                console.log('  ', chalk.gray('Name:'), pos.name);
              }
            } else {
              console.log(chalk.yellow('⚠'), `Line ${lineNum} (${name}): Not mapped`);
            }

            // Show the actual line content
            console.log('  ', chalk.gray('Code:'), line.trim().substring(0, 60));
            console.log();
            break;
          }
        }
      });

      if (!foundTestableLines) {
        console.log(chalk.gray('No test patterns found in code'));
      }

      // Check if sources are accessible
      console.log(chalk.yellow('▶ Source Files'));
      console.log(chalk.gray('─'.repeat(40)));

      consumer.sources.forEach((source, index) => {
        const hasContent = sourcemap.data.sourcesContent && sourcemap.data.sourcesContent[index];
        console.log(hasContent ? chalk.green('✓') : chalk.yellow('○'), source);
        if (hasContent) {
          const content = sourcemap.data.sourcesContent[index];
          const lines = content.split('\n').length;
          console.log('  ', chalk.gray(`${lines} lines, ${content.length} bytes`));
        } else {
          console.log('  ', chalk.gray('No embedded content'));
        }
      });

      console.log();

      // Validation summary
      console.log(chalk.yellow('▶ Validation Summary'));
      console.log(chalk.gray('─'.repeat(40)));

      const issues = [];

      if (mappingSegments.length !== jsLines.length) {
        issues.push(`Mapping segments (${mappingSegments.length}) don't match output lines (${jsLines.length})`);
      }

      if (nonEmptySegments.length === 0) {
        issues.push('No actual mappings found (all segments are empty)');
      }

      if (!sourcemap.data.sourcesContent || sourcemap.data.sourcesContent.length === 0) {
        issues.push('No embedded source content (debugging will require source files)');
      }

      if (issues.length === 0) {
        console.log(chalk.green('✓'), 'Sourcemap appears valid and complete');
      } else {
        issues.forEach(issue => {
          console.log(chalk.yellow('⚠'), issue);
        });
      }
    });

  } catch (error) {
    console.log(chalk.red('✗'), 'Failed to parse sourcemap with Mozilla source-map:');
    console.log('  ', error.message);

    // Try to provide more specific error information
    if (error.message.includes('Invalid mapping')) {
      console.log();
      console.log(chalk.yellow('ℹ'), 'This usually means the VLQ encoding is corrupted or incomplete.');
      console.log(chalk.yellow('ℹ'), 'Check that the mappings field contains valid base64 VLQ data.');
    }
  }
}

// Run analysis
analyzeMappings().then(() => {
  console.log();
  console.log(chalk.cyan('═'.repeat(80)));
}).catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});