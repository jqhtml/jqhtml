/**
 * Manual test script for SSR server
 * Tests with real jqhtml bundles
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const { SSRServer } = require('./src/server.js');

const PORT = 9877;

function sendRequest(port, request) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ port }, () => {
      client.write(JSON.stringify(request) + '\n');
    });

    let data = '';
    client.on('data', (chunk) => {
      data += chunk.toString();
      if (data.includes('\n')) {
        client.end();
        try {
          resolve(JSON.parse(data.trim()));
        } catch (err) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      }
    });

    client.on('error', reject);
    setTimeout(() => {
      client.end();
      reject(new Error('Request timeout'));
    }, 30000);
  });
}

async function main() {
  const server = new SSRServer({ maxBundles: 5, defaultTimeout: 30000 });

  try {
    await server.listenTCP(PORT);
    console.log('');

    // Test 1: Ping
    console.log('=== Test 1: Ping ===');
    const pingResponse = await sendRequest(PORT, {
      id: 'test-ping',
      type: 'ping',
      payload: {}
    });
    console.log('Response:', JSON.stringify(pingResponse, null, 2));
    console.log('');

    // Test 2: Load real bundles and render
    console.log('=== Test 2: Real Bundle Render ===');
    const bundlesDir = path.resolve(__dirname, '../../bundles_for_ssr_test');

    const vendorPath = path.join(bundlesDir, 'Frontend_Bundle__vendor.50b276b0.js');
    const appPath = path.join(bundlesDir, 'Frontend_Bundle__app.80f90eae.js');

    if (!fs.existsSync(vendorPath) || !fs.existsSync(appPath)) {
      console.log('Real bundles not found at:', bundlesDir);
      console.log('Skipping real bundle test');
    } else {
      const vendorContent = fs.readFileSync(vendorPath, 'utf8');
      const appContent = fs.readFileSync(appPath, 'utf8');

      console.log(`Vendor bundle: ${(vendorContent.length / 1024).toFixed(1)} KB`);
      console.log(`App bundle: ${(appContent.length / 1024).toFixed(1)} KB`);

      const renderResponse = await sendRequest(PORT, {
        id: 'test-render',
        type: 'render',
        payload: {
          bundles: [
            { id: 'vendor', content: vendorContent },
            { id: 'app', content: appContent }
          ],
          component: 'Dashboard_Index_Action',
          args: {},
          options: {
            baseUrl: 'http://localhost:3000',
            timeout: 30000
          }
        }
      });

      if (renderResponse.status === 'success') {
        console.log('Render SUCCESS!');
        console.log(`HTML size: ${renderResponse.payload.html.length} bytes`);
        console.log(`Timing: ${JSON.stringify(renderResponse.payload.timing)}`);
        console.log(`Cache keys: localStorage=${Object.keys(renderResponse.payload.cache.localStorage).length}, sessionStorage=${Object.keys(renderResponse.payload.cache.sessionStorage).length}`);
        console.log('');
        console.log('First 500 chars of HTML:');
        console.log(renderResponse.payload.html.substring(0, 500));
      } else {
        console.log('Render FAILED:');
        console.log(JSON.stringify(renderResponse.error, null, 2));
      }
    }

    // Test 3: Server stats
    console.log('\n=== Test 3: Server Stats ===');
    console.log(JSON.stringify(server.stats(), null, 2));

  } finally {
    await server.stop();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
