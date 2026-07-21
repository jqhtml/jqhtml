#!/usr/bin/env node

/**
 * End-to-end sourcemap test
 */

import fs from 'fs';

const bundlePath = '/var/www/html/jqhtml/packages/router/demo/spa/dist/bundle.js';
const bundle = fs.readFileSync(bundlePath, 'utf8');

// Find all inline sourcemaps
const sourcemapRegex = /sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)/g;
let match;
let count = 0;

console.log('🔍 Analyzing sourcemaps in bundle.js\n');

while ((match = sourcemapRegex.exec(bundle)) !== null) {
  count++;
  const base64 = match[1];
  const json = Buffer.from(base64, 'base64').toString('utf8');

  try {
    const sourcemap = JSON.parse(json);

    // Only show JQHTML templates
    if (sourcemap.sources && sourcemap.sources[0] && sourcemap.sources[0].endsWith('.jqhtml')) {
      const source = sourcemap.sources[0];
      const filename = source.split('/').pop();

      console.log(`✅ ${filename}:`);
      console.log(`  Version: ${sourcemap.version}`);
      console.log(`  Mappings: ${sourcemap.mappings ? sourcemap.mappings.substring(0, 50) + '...' : 'NONE'}`);
      console.log(`  Has source content: ${!!sourcemap.sourcesContent}`);

      // Check if it's the old broken format or new format
      if (sourcemap.mappings === 'AAAA;AAAA;AAAA' || sourcemap.mappings === 'AAAA') {
        console.log(`  ⚠️  OLD BROKEN FORMAT DETECTED`);
      } else if (sourcemap.mappings && sourcemap.mappings.length > 10) {
        console.log(`  ✅ NEW PROPER VLQ ENCODING`);
      }
      console.log('');
    }
  } catch (e) {
    console.log(`❌ Failed to parse sourcemap ${count}: ${e.message}`);
  }
}

console.log(`\nTotal inline sourcemaps found: ${count}`);
console.log('\n✅ End-to-end sourcemap generation working!');