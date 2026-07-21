/**
 * JQHTML SSR Proof of Concept - Test Script
 *
 * Loads the real application bundles and attempts to render
 * the Dashboard_Index_Action component.
 */

const { SSREnvironment } = require('./ssr.js');
const path = require('path');

// Paths to the test bundles
const BUNDLES_DIR = path.resolve(__dirname, '../../bundles_for_ssr_test');

const BUNDLES = [
  // Load vendor first (contains jqhtml core)
  path.join(BUNDLES_DIR, 'Frontend_Bundle__vendor.50b276b0.js'),
  // Then app bundle (contains templates and classes)
  path.join(BUNDLES_DIR, 'Frontend_Bundle__app.80f90eae.js'),
];

async function main() {
  console.log('='.repeat(60));
  console.log('JQHTML SSR Proof of Concept');
  console.log('='.repeat(60));
  console.log('');

  // Create and initialize the SSR environment
  const env = new SSREnvironment();
  env.init();

  // Load the bundles
  console.log('\n--- Loading Bundles ---');
  try {
    env.loadBundles(BUNDLES);
  } catch (err) {
    console.error('Failed to load bundles:', err);
    process.exit(1);
  }

  // Check if jqhtml is available
  console.log('\n--- Checking jqhtml ---');
  if (env.isJqhtmlReady()) {
    console.log('jqhtml runtime is available');

    // List some registered templates
    const templates = env.getRegisteredTemplates();
    console.log(`Registered templates: ${templates.length}`);
    if (templates.length > 0) {
      console.log('First 10 templates:', templates.slice(0, 10));
    }
  } else {
    console.error('jqhtml runtime NOT available');
    process.exit(1);
  }

  // Try to render the Dashboard_Index_Action component
  console.log('\n--- Rendering Dashboard_Index_Action ---');
  try {
    const html = await env.render('Dashboard_Index_Action', {});

    console.log('\n--- Rendered HTML ---');
    console.log(html);

    console.log('\n--- Success! ---');
    console.log(`Rendered ${html.length} characters of HTML`);

  } catch (err) {
    console.error('\n--- Render Failed ---');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
