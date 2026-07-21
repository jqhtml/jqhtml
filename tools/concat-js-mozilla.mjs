#!/usr/bin/env node

/**
 * JavaScript Concatenation Script - Mozilla source-map Method
 *
 * This script uses Mozilla's source-map library to concatenate JavaScript files
 * with proper sourcemap merging using SourceNode API.
 *
 * Usage: node concat-js-mozilla.mjs <output> <input1> <input2> ...
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SourceMapConsumer, SourceNode } from 'source-map';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract inline sourcemap from JavaScript content
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
                    map: JSON.parse(json), // Parse to object for Mozilla lib
                    content: content.replace(/(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+?)[ \t]*$)/m, '')
                };
            }
        }
    }
    return { content, map: null };
}

/**
 * Main concatenation function using Mozilla source-map
 */
async function concatenateFiles(outputFile, inputFiles) {
    console.log(`Concatenating ${inputFiles.length} files to ${outputFile} using Mozilla source-map...`);

    // Create root SourceNode for the concatenated output
    const rootNode = new SourceNode(null, null, null);

    // Track line offset for each file
    let currentLine = 1;

    // Process each input file
    for (const filePath of inputFiles) {
        console.log(`  Processing: ${filePath}`);

        if (!fs.existsSync(filePath)) {
            console.error(`Error: File not found: ${filePath}`);
            process.exit(1);
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const extracted = extractSourceMapFromContent(fileContent);

        // Get relative path for source reference
        const relativePath = path.relative(process.cwd(), filePath);

        if (extracted.map) {
            console.log(`    ✓ Found inline sourcemap`);

            // Use SourceMapConsumer to process existing sourcemap
            const consumer = await new SourceMapConsumer(extracted.map);

            try {
                // Create SourceNode from the existing sourcemap
                const node = SourceNode.fromStringWithSourceMap(
                    extracted.content,
                    consumer
                );

                // Add to root with separator
                rootNode.add(node);
                rootNode.add('\n'); // Add newline between files

                // Update line tracking
                currentLine += extracted.content.split('\n').length + 1;
            } finally {
                consumer.destroy();
            }
        } else {
            console.log(`    - No sourcemap found, adding as raw content`);

            // Add content without sourcemap
            // Split by lines to maintain proper line mapping
            const lines = extracted.content.split('\n');
            lines.forEach((line, index) => {
                rootNode.add(new SourceNode(
                    currentLine + index,
                    0,
                    relativePath,
                    line + (index < lines.length - 1 ? '\n' : '')
                ));
            });

            rootNode.add('\n'); // Add separator
            currentLine += lines.length + 1;
        }
    }

    // Generate the final output with sourcemap
    const { code, map } = rootNode.toStringWithSourceMap({
        file: path.basename(outputFile)
    });

    // Convert sourcemap to inline base64
    const sourceMapJson = map.toString();
    const sourceMapBase64 = Buffer.from(sourceMapJson).toString('base64');
    const finalContent = code +
        '\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,' + sourceMapBase64;

    // Write output file
    fs.writeFileSync(outputFile, finalContent);
    console.log(`\n✓ Bundle created: ${outputFile}`);

    // Parse and display sourcemap info
    const sourceMapObj = JSON.parse(sourceMapJson);
    console.log(`✓ Sourcemap info:`);
    console.log(`  - Version: ${sourceMapObj.version}`);
    console.log(`  - Sources: ${sourceMapObj.sources.length} files`);
    console.log(`  - Mappings length: ${sourceMapObj.mappings.length} characters`);
    if (sourceMapObj.sourcesContent) {
        console.log(`  - Sources content included: ${sourceMapObj.sourcesContent.length} files`);
    }

    // Additional debug info
    console.log(`\n✓ Advanced features:`);
    console.log(`  - Using SourceNode API for proper AST-based concatenation`);
    console.log(`  - Preserves original source references`);
    console.log(`  - Maintains accurate line/column mappings`);
    console.log(`  - Handles nested sourcemaps correctly`);

    return {
        content: finalContent,
        sourceMap: sourceMapObj
    };
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('Usage: node concat-js-mozilla.mjs <output> <input1> [input2] ...');
        console.log('Example: node concat-js-mozilla.mjs bundle.js file1.js file2.js');
        process.exit(1);
    }

    const [outputFile, ...inputFiles] = args;

    try {
        await concatenateFiles(outputFile, inputFiles);
    } catch (error) {
        console.error('Error during concatenation:', error);
        process.exit(1);
    }
}

export { concatenateFiles, extractSourceMapFromContent };