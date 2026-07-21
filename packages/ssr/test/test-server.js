/**
 * Server integration tests
 *
 * Tests the full SSR server with a simple inline bundle.
 */

const net = require('net');
const { SSRServer } = require('../src/server.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return fn().then(() => {
    console.log(`✅ ${name}`);
    passed++;
  }).catch((err) => {
    console.log(`❌ ${name}`);
    console.log(`   ${err.message}`);
    failed++;
  });
}

function assertEqual(actual, expected, msg = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, msg = '') {
  if (!value) {
    throw new Error(msg || 'Expected true');
  }
}

/**
 * Send a request to the server and get response
 */
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

    // Timeout
    setTimeout(() => {
      client.end();
      reject(new Error('Request timeout'));
    }, 5000);
  });
}

// Simple bundle that defines a test component
// This simulates what a real jqhtml bundle would look like
const SIMPLE_BUNDLE = `
// Minimal jqhtml mock for testing
(function(window) {
  var jqhtml = window.jqhtml = window.jqhtml || {
    _templates: new Map(),
    _components: new Map(),
    register_template: function(template) {
      this._templates.set(template.name, template);
    },
    register_component: function(name, cls) {
      this._components.set(name, cls);
    }
  };

  // Simple component base
  function Jqhtml_Component($element, args) {
    this.$ = $element;
    this.args = args || {};
    this.data = {};
    this._ready_state = 0;
  }
  Jqhtml_Component.prototype.ready = function() {
    return Promise.resolve();
  };
  window.Jqhtml_Component = Jqhtml_Component;

  // Test component
  function Test_Component($element, args) {
    Jqhtml_Component.call(this, $element, args);
    this._ready_state = 4;
    this.$.addClass('Test_Component Component');
    this.$.html('<div class="test-content">Hello ' + (args.name || 'World') + '!</div>');
  }
  Test_Component.prototype = Object.create(Jqhtml_Component.prototype);
  Test_Component.prototype.constructor = Test_Component;

  // Register
  jqhtml._templates.set('Test_Component', { name: 'Test_Component' });
  jqhtml._components.set('Test_Component', Test_Component);

  // jQuery component plugin
  var $ = window.$;
  if ($ && $.fn) {
    $.fn.component = function(name, args) {
      if (arguments.length === 0) {
        return this.data('jqhtml_component');
      }
      var ComponentClass = jqhtml._components.get(name) || Jqhtml_Component;
      var instance = new ComponentClass(this, args);
      this.data('jqhtml_component', instance);
      return this;
    };
  }
})(window);
`;

async function runTests() {
  const PORT = 19876;
  const server = new SSRServer({ maxBundles: 5, defaultTimeout: 5000 });

  try {
    await server.listenTCP(PORT);
    console.log(`Test server started on port ${PORT}\n`);

    // Test: Ping
    await test('Server responds to ping', async () => {
      const response = await sendRequest(PORT, {
        id: 'ping-1',
        type: 'ping',
        payload: {}
      });
      assertEqual(response.status, 'success');
      assertTrue(response.payload.uptime_ms >= 0, 'uptime should be >= 0');
    });

    // Test: Invalid request
    await test('Server handles invalid JSON gracefully', async () => {
      const response = await new Promise((resolve, reject) => {
        const client = net.createConnection({ port: PORT }, () => {
          client.write('not valid json\n');
        });
        let data = '';
        client.on('data', (chunk) => {
          data += chunk.toString();
          if (data.includes('\n')) {
            client.end();
            resolve(JSON.parse(data.trim()));
          }
        });
        client.on('error', reject);
        setTimeout(() => reject(new Error('timeout')), 5000);
      });
      assertEqual(response.status, 'error');
      assertEqual(response.error.code, 'PARSE_ERROR');
    });

    // Test: Render with mock bundle
    await test('Server renders component with mock bundle', async () => {
      const response = await sendRequest(PORT, {
        id: 'render-1',
        type: 'render',
        payload: {
          bundles: [{ id: 'test-bundle', content: SIMPLE_BUNDLE }],
          component: 'Test_Component',
          args: { name: 'SSR' },
          options: { baseUrl: 'http://localhost', timeout: 5000 }
        }
      });

      assertEqual(response.status, 'success', `Expected success but got: ${JSON.stringify(response)}`);
      assertTrue(response.payload.html.includes('Test_Component'), 'HTML should include component class');
      assertTrue(response.payload.html.includes('Hello SSR'), 'HTML should include rendered content');
      assertTrue(response.payload.timing.total_ms > 0, 'Should have timing info');
    });

    // Test: Component not found
    await test('Server returns error for unknown component', async () => {
      const response = await sendRequest(PORT, {
        id: 'render-2',
        type: 'render',
        payload: {
          bundles: [{ id: 'test-bundle-2', content: SIMPLE_BUNDLE }],
          component: 'Nonexistent_Component',
          args: {},
          options: { baseUrl: 'http://localhost' }
        }
      });
      assertEqual(response.status, 'error');
      // Could be COMPONENT_NOT_FOUND or RENDER_ERROR depending on timing
      assertTrue(
        response.error.code === 'COMPONENT_NOT_FOUND' || response.error.code === 'RENDER_ERROR',
        `Expected error code, got: ${response.error.code}`
      );
    });

    // Test: Flush cache
    await test('Server can flush cache', async () => {
      const response = await sendRequest(PORT, {
        id: 'flush-1',
        type: 'flush_cache',
        payload: {}
      });
      assertEqual(response.status, 'success');
      assertTrue(response.payload.flushed);
    });

    // Test: Bundle caching - check cache stats
    await test('Server caches bundles', async () => {
      // Flush cache first to ensure clean state
      await sendRequest(PORT, { id: 'pre-flush', type: 'flush_cache', payload: {} });

      // Render with a unique bundle ID
      const response1 = await sendRequest(PORT, {
        id: 'cache-1',
        type: 'render',
        payload: {
          bundles: [{ id: 'cache-test-unique', content: SIMPLE_BUNDLE }],
          component: 'Test_Component',
          args: { name: 'Cache1' },
          options: { baseUrl: 'http://localhost' }
        }
      });

      if (response1.status !== 'success') {
        throw new Error(`First render failed: ${JSON.stringify(response1.error)}`);
      }

      // Check stats - cache should have the bundle now
      const stats = server.stats();
      assertTrue(stats.bundle_cache.size > 0, 'Cache should have entries after render');
      assertTrue(
        stats.bundle_cache.keys.some(k => k.includes('cache-test-unique')),
        'Cache should contain our bundle ID'
      );
    });

  } finally {
    await server.stop();
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Server tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
