/**
 * Debug script to see what happens when loading real bundles
 */

const fs = require('fs');
const path = require('path');
const { SSREnvironment } = require('./src/environment.js');
const { prepareBundleCode } = require('./src/bundle-cache.js');

async function main() {
  const bundlesDir = path.resolve(__dirname, '../../bundles_for_ssr_test');
  const vendorPath = path.join(bundlesDir, 'Frontend_Bundle__vendor.50b276b0.js');
  const appPath = path.join(bundlesDir, 'Frontend_Bundle__app.80f90eae.js');

  console.log('Loading bundles...');
  const vendorContent = fs.readFileSync(vendorPath, 'utf8');
  const appContent = fs.readFileSync(appPath, 'utf8');

  console.log(`Vendor: ${(vendorContent.length / 1024).toFixed(1)} KB`);
  console.log(`App: ${(appContent.length / 1024).toFixed(1)} KB`);

  const env = new SSREnvironment({
    baseUrl: 'http://localhost:3000',
    timeout: 30000
  });

  env.init();
  console.log('\nEnvironment initialized');
  console.log('jQuery available:', typeof global.$ === 'function');
  console.log('jQuery.fn:', !!global.$.fn);

  // Check for jqhtml before loading bundles
  console.log('\nBefore bundles:');
  console.log('window.jqhtml:', typeof global.window.jqhtml);

  // Prepare and execute bundles
  const bundles = [
    { id: 'vendor', content: vendorContent },
    { id: 'app', content: appContent }
  ];
  const code = prepareBundleCode(bundles);

  console.log('\nExecuting bundles...');
  try {
    env.execute(code, 'test-bundles');
    console.log('Bundles executed successfully');
  } catch (err) {
    console.log('Bundle execution error:', err.message);
    console.log(err.stack);
  }

  // Check after loading bundles
  console.log('\nAfter bundles:');
  console.log('window.jqhtml:', typeof global.window.jqhtml);

  if (global.window.jqhtml) {
    console.log('jqhtml object keys:', Object.keys(global.window.jqhtml));

    // Use real jqhtml API
    if (typeof global.window.jqhtml.get_registered_templates === 'function') {
      const templates = global.window.jqhtml.get_registered_templates();
      console.log(`Registered templates: ${templates.length}`);
      console.log('All templates:', templates);

      // Search for Dashboard-related
      const dashboardTemplates = templates.filter(t => t.toLowerCase().includes('dashboard'));
      console.log('Dashboard templates:', dashboardTemplates);
    } else {
      console.log('get_registered_templates not available');
    }

    if (typeof global.window.jqhtml.list_components === 'function') {
      const components = global.window.jqhtml.list_components();
      console.log(`Registered components: ${components.length}`);
      if (components.length > 0) {
        console.log('First 10:', components.slice(0, 10));
      }
    }

    if (typeof global.window.jqhtml.get_component_names === 'function') {
      const names = global.window.jqhtml.get_component_names();
      console.log(`Component names: ${names.length}`);
      if (names.length > 0) {
        console.log('First 10:', names.slice(0, 10));
      }
    }

    // Check if component is registered
    if (typeof global.window.jqhtml.has_component === 'function') {
      console.log('Has Dashboard_Index_Action:', global.window.jqhtml.has_component('Dashboard_Index_Action'));
    }
  }

  // Check if $.fn.component exists
  console.log('\n$.fn.component:', typeof global.$.fn.component);

  // Check for errors in console
  console.log('\nChecking for Jqhtml_Component:');
  console.log('window.Jqhtml_Component:', typeof global.window.Jqhtml_Component);
  console.log('global.Jqhtml_Component:', typeof global.Jqhtml_Component);

  env.destroy();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
