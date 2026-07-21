#!/usr/bin/env node

/**
 * JavaScript Concatenation Script - RSpade Method Replication
 *
 * This script replicates RSpade's exact process for concatenating JavaScript files
 * with sourcemaps using concat-with-sourcemaps package.
 *
 * Usage: node concat-js-rspade.js <output> <input1> <input2> ...
 */

const fs = require('fs');
const path = require('path');
const Concat = require('concat-with-sourcemaps');

/**
 * Extract inline sourcemap from JavaScript content
 * This is the exact function RSpade uses
 */
function extractSourceMapFromContent(content) {
    const match = content.match(/(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+?)[ \t]*$)/m);
    if (match && match[1]) {
        const url = match[1];
        if (url.startsWith('data:')) {
            const base64Match = url.match(/base64,(.*)$/);
            if (base64Match) {
                const json = Buffer.from(base64Match[1], 'base64').toString('utf8');
                return {
                    map: json,  // JSON string, NOT parsed object - important!
                    content: content.replace(/(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+?)[ \t]*$)/m, '')
                };
            }
        }
    }
    return { content, map: null };
}

/**
 * Main concatenation function
 */
function concatenateFiles(outputFile, inputFiles) {
    console.log(`Concatenating ${inputFiles.length} files to ${outputFile}...`);

    // Initialize concat with sourcemap support
    // true = generate sourcemap, 'bundle.js' = output filename, '\n' = separator
    const concat = new Concat(true, path.basename(outputFile), '\n');

    // Process each input file
    for (const filePath of inputFiles) {
        console.log(`  Processing: ${filePath}`);

        if (!fs.existsSync(filePath)) {
            console.error(`Error: File not found: ${filePath}`);
            process.exit(1);
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const extracted = extractSourceMapFromContent(fileContent);

        // Add file to concatenation
        // Important: map must be passed as STRING, not parsed JSON
        if (extracted.map) {
            console.log(`    ✓ Found inline sourcemap`);
            concat.add(filePath, extracted.content, extracted.map);
        } else {
            console.log(`    - No sourcemap found`);
            concat.add(filePath, extracted.content);
        }
    }

    // Generate final bundle with inline sourcemap
    const sourceMapBase64 = Buffer.from(concat.sourceMap).toString('base64');
    const finalContent = concat.content +
        '\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,' + sourceMapBase64;

    // Write output file
    fs.writeFileSync(outputFile, finalContent);
    console.log(`\n✓ Bundle created: ${outputFile}`);

    // Parse and display sourcemap info
    const sourceMap = JSON.parse(concat.sourceMap);
    console.log(`✓ Sourcemap info:`);
    console.log(`  - Version: ${sourceMap.version}`);
    console.log(`  - Sources: ${sourceMap.sources.length} files`);
    console.log(`  - Mappings length: ${sourceMap.mappings.length} characters`);
    if (sourceMap.sourcesContent) {
        console.log(`  - Sources content included: ${sourceMap.sourcesContent.length} files`);
    }

    return {
        content: finalContent,
        sourceMap: sourceMap
    };
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('Usage: node concat-js-rspade.js <output> <input1> [input2] ...');
        console.log('Example: node concat-js-rspade.js bundle.js file1.js file2.js');
        process.exit(1);
    }

    const [outputFile, ...inputFiles] = args;

    try {
        concatenateFiles(outputFile, inputFiles);
    } catch (error) {
        console.error('Error during concatenation:', error);
        process.exit(1);
    }
}

module.exports = { concatenateFiles, extractSourceMapFromContent };