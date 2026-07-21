/**
 * render_spa E2E tests
 *
 * Tests the full SPA rendering pipeline: protocol validation,
 * bundle execution, component lifecycle, data fetching, and meta extraction.
 */

const net = require('net');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SSRServer } = require('../src/server.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return fn().then(() => {
    console.log(`\u2705 ${name}`);
    passed++;
  }).catch((err) => {
    console.log(`\u274c ${name}`);
    console.log(`   ${err.message}`);
    if (err.stack) {
      // Show first 3 lines of stack
      const stackLines = err.stack.split('\n').slice(1, 4).join('\n');
      console.log(`   ${stackLines}`);
    }
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
 * Send a request to the SSR server and get response
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

    setTimeout(() => {
      client.end();
      reject(new Error('Request timeout'));
    }, 10000);
  });
}

/**
 * Mock SPA bundle that simulates a rspade-like SPA framework.
 *
 * On execution, if window.rsxapp.is_spa === true:
 * 1. Creates #spa-root if it doesn't exist
 * 2. Reads window.location.pathname for route matching
 * 3. Renders a component for the matched route into #spa-root
 * 4. Components use $.ajax() for data fetching in on_load()
 */
function createMockSpaBundle(options = {}) {
  const dataFetchUrl = options.dataFetchUrl || null;

  return `
(function(window) {
  var $ = window.$;
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

  // Simple component base with ready() promise
  function Jqhtml_Component($element, args) {
    this.$ = $element;
    this.args = args || {};
    this.data = {};
    this._ready_resolve = null;
    this._ready_promise = new Promise(function(resolve) {
      this._ready_resolve = resolve;
    }.bind(this));
  }
  Jqhtml_Component.prototype.ready = function() {
    return this._ready_promise;
  };
  Jqhtml_Component.prototype._markReady = function() {
    if (this._ready_resolve) this._ready_resolve();
  };
  window.Jqhtml_Component = Jqhtml_Component;

  // jQuery component plugin
  $.fn.component = function(name, args) {
    if (arguments.length === 0) {
      return this.data('jqhtml_component');
    }
    var ComponentClass = jqhtml._components.get(name) || Jqhtml_Component;
    var instance = new ComponentClass(this, args);
    this.data('jqhtml_component', instance);
    return this;
  };

  // --- Mock SPA Router ---

  // Home Page component
  function Home_Page($el, args) {
    Jqhtml_Component.call(this, $el, args);
    this.$.addClass('Home_Page Component');
    this.$.html('<h1>Welcome Home</h1><p>This is the home page</p>');
    this._markReady();
  }
  Home_Page.prototype = Object.create(Jqhtml_Component.prototype);
  jqhtml._templates.set('Home_Page', { name: 'Home_Page' });
  jqhtml._components.set('Home_Page', Home_Page);

  // About Page component
  function About_Page($el, args) {
    Jqhtml_Component.call(this, $el, args);
    this.$.addClass('About_Page Component');
    this.$.html('<h1>About Us</h1><p>About page content</p>');
    this._markReady();
  }
  About_Page.prototype = Object.create(Jqhtml_Component.prototype);
  jqhtml._templates.set('About_Page', { name: 'About_Page' });
  jqhtml._components.set('About_Page', About_Page);

  ${dataFetchUrl ? `
  // Data-fetching component that uses $.ajax()
  function Data_Page($el, args) {
    Jqhtml_Component.call(this, $el, args);
    var self = this;
    this.$.addClass('Data_Page Component');
    this.$.html('<div class="loading">Loading...</div>');

    // Simulate on_load() - fetch data via $.ajax()
    $.ajax({
      url: '${dataFetchUrl}/api/items',
      method: 'GET',
      dataType: 'json',
      success: function(data) {
        self.data.items = data.items;
        self.$.html('<h1>Items</h1><ul>' +
          data.items.map(function(item) { return '<li>' + item.name + '</li>'; }).join('') +
          '</ul>');
        self._markReady();
      },
      error: function(jqXHR, textStatus) {
        self.$.html('<div class="error">Failed to load: ' + textStatus + '</div>');
        self._markReady();
      }
    });
  }
  Data_Page.prototype = Object.create(Jqhtml_Component.prototype);
  jqhtml._templates.set('Data_Page', { name: 'Data_Page' });
  jqhtml._components.set('Data_Page', Data_Page);
  ` : ''}

  // Meta-aware component
  function Meta_Page($el, args) {
    Jqhtml_Component.call(this, $el, args);
    this.$.addClass('Meta_Page Component');
    this.$.html('<h1>Property Details</h1><p>160 Acres in Story County</p>');

    // Set page metadata
    document.title = '160 Acres in Story County - LandProz';
    var metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    metaDesc.setAttribute('content', 'Premium farmland auction in central Iowa');
    document.head.appendChild(metaDesc);

    var ogImage = document.createElement('meta');
    ogImage.setAttribute('property', 'og:image');
    ogImage.setAttribute('content', 'https://cdn.example.com/property-photo.jpg');
    document.head.appendChild(ogImage);

    this.page_title = function() { return '160 Acres in Story County - LandProz'; };
    this._markReady();
  }
  Meta_Page.prototype = Object.create(Jqhtml_Component.prototype);
  jqhtml._templates.set('Meta_Page', { name: 'Meta_Page' });
  jqhtml._components.set('Meta_Page', Meta_Page);

  // Timeout component (never reaches ready)
  function Stuck_Page($el, args) {
    Jqhtml_Component.call(this, $el, args);
    this.$.addClass('Stuck_Page Component');
    this.$.html('<div>This page never finishes loading</div>');
    // Intentionally never calls _markReady()
  }
  Stuck_Page.prototype = Object.create(Jqhtml_Component.prototype);
  jqhtml._templates.set('Stuck_Page', { name: 'Stuck_Page' });
  jqhtml._components.set('Stuck_Page', Stuck_Page);

  // SPA Router - matches URL to component and renders into #spa-root
  if (window.rsxapp && window.rsxapp.is_spa) {
    var routes = {
      '/': 'Home_Page',
      '/about': 'About_Page',
      '/data': 'Data_Page',
      '/property/123': 'Meta_Page',
      '/stuck': 'Stuck_Page'
    };

    var pathname = window.location.pathname;
    var componentName = routes[pathname];

    if (componentName && jqhtml._components.has(componentName)) {
      // Create #spa-root if it doesn't exist
      var $root = $('#spa-root');
      if ($root.length === 0) {
        $root = $('<div id="spa-root">').appendTo('body');
      }

      // Create a wrapper div and render the component
      var $wrapper = $('<div>').appendTo($root);
      $wrapper.component(componentName, window.rsxapp.params || {});
    }
  }
})(window);
`;
}

// rsxapp test data
const TEST_RSXAPP = {
  is_spa: true,
  is_auth: false,
  user: null,
  site: { id: 1, name: 'TestSite', domain: 'test.example.com' },
  csrf: null,
  params: {},
  build_key: 'test-build-123',
  debug: false,
  ajax_batching: true
};

async function runTests() {
  console.log('render_spa E2E Tests\n');

  const PORT = 19877;
  const server = new SSRServer({ maxBundles: 5, defaultTimeout: 5000 });

  // Mock data server for data fetching tests
  let mockDataServer;
  let mockDataPort;
  let receivedSsrToken = null;

  try {
    // Start mock data server
    await new Promise((resolve) => {
      mockDataServer = http.createServer((req, res) => {
        receivedSsrToken = req.headers['x-ssr-token'] || null;

        if (req.url === '/api/items') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            items: [
              { id: 1, name: 'Widget Alpha' },
              { id: 2, name: 'Widget Beta' },
              { id: 3, name: 'Widget Gamma' }
            ]
          }));
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });
      mockDataServer.listen(0, '127.0.0.1', () => {
        mockDataPort = mockDataServer.address().port;
        resolve();
      });
    });

    const mockDataUrl = `http://127.0.0.1:${mockDataPort}`;

    await server.listenTCP(PORT);
    console.log(`Test SSR server on port ${PORT}, mock data server on port ${mockDataPort}\n`);

    // Test 1: Basic render_spa returns HTML
    await test('render_spa returns rendered HTML', async () => {
      const response = await sendRequest(PORT, {
        id: 'spa-1',
        type: 'render_spa',
        payload: {
          bundles: [{ id: 'spa-bundle', content: createMockSpaBundle() }],
          url: '/',
          rsxapp: TEST_RSXAPP,
          options: { baseUrl: 'http://localhost' }
        }
      });

      assertEqual(response.status, 'success', `Expected success: ${JSON.stringify(response.error)}`);
      assertTrue(response.payload.html.includes('Welcome Home'), 'Should contain Home_Page content');
      assertTrue(response.payload.html.includes('Home_Page'), 'Should contain component class');
      assertTrue(response.payload.timing.total_ms > 0, 'Should have timing');
    });

    // Test 2: URL routing - different URLs render different content
    await test('render_spa routes to correct component by URL', async () => {
      const response = await sendRequest(PORT, {
        id: 'spa-2',
        type: 'render_spa',
        payload: {
          bundles: [{ id: 'spa-bundle', content: createMockSpaBundle() }],
          url: '/about',
          rsxapp: TEST_RSXAPP,
          options: { baseUrl: 'http://localhost' }
        }
      });

      assertEqual(response.status, 'success', `Expected success: ${JSON.stringify(response.error)}`);
      assertTrue(response.payload.html.includes('About Us'), 'Should contain About_Page content');
      assertTrue(response.payload.html.includes('About_Page'), 'Should contain About_Page class');
    });

    // Test 3: rsxapp injection - data is available to bundle code
    await test('render_spa injects rsxapp data', async () => {
      // Create a bundle that reads rsxapp and renders site name
      const rsxappBundle = `
(function(window) {
  var $ = window.$;
  window.jqhtml = window.jqhtml || { _templates: new Map(), _components: new Map() };

  function Jqhtml_Component($el, args) {
    this.$ = $el; this.args = args; this.data = {};
    this._rp = null;
    this._ready_promise = new Promise(function(r) { this._rp = r; }.bind(this));
  }
  Jqhtml_Component.prototype.ready = function() { return this._ready_promise; };

  $.fn.component = function(name, args) {
    if (arguments.length === 0) return this.data('jqhtml_component');
    var inst = new Jqhtml_Component(this, args);
    this.data('jqhtml_component', inst);
    return this;
  };

  if (window.rsxapp && window.rsxapp.is_spa) {
    var $root = $('<div id="spa-root">').appendTo('body');
    var $wrapper = $('<div>').appendTo($root);
    $wrapper.component('Rsxapp_Test', {});
    var comp = $wrapper.component();
    comp.$.addClass('Rsxapp_Test Component');
    comp.$.html('<div>Site: ' + window.rsxapp.site.name + ', Auth: ' + window.rsxapp.is_auth + '</div>');
    comp._rp();
  }
})(window);
`;

      const response = await sendRequest(PORT, {
        id: 'spa-3',
        type: 'render_spa',
        payload: {
          bundles: [{ id: 'rsxapp-bundle', content: rsxappBundle }],
          url: '/',
          rsxapp: { ...TEST_RSXAPP, site: { id: 1, name: 'MyTestSite', domain: 'test.com' } },
          options: { baseUrl: 'http://localhost' }
        }
      });

      assertEqual(response.status, 'success', `Expected success: ${JSON.stringify(response.error)}`);
      assertTrue(response.payload.html.includes('Site: MyTestSite'), 'Should contain site name from rsxapp');
      assertTrue(response.payload.html.includes('Auth: false'), 'Should show is_auth from rsxapp');
    });

    // Test 4: Data fetching via $.ajax()
    await test('render_spa with $.ajax() data fetching', async () => {
      const response = await sendRequest(PORT, {
        id: 'spa-4',
        type: 'render_spa',
        payload: {
          bundles: [{ id: 'data-bundle', content: createMockSpaBundle({ dataFetchUrl: mockDataUrl }) }],
          url: '/data',
          rsxapp: TEST_RSXAPP,
          options: { baseUrl: mockDataUrl, timeout: 5000 }
        }
      });

      assertEqual(response.status, 'success', `Expected success: ${JSON.stringify(response.error)}`);
      assertTrue(response.payload.html.includes('Widget Alpha'), 'Should contain fetched data item 1');
      assertTrue(response.payload.html.includes('Widget Beta'), 'Should contain fetched data item 2');
      assertTrue(response.payload.html.includes('Widget Gamma'), 'Should contain fetched data item 3');
    });

    // Test 5: Meta extraction
    await test('render_spa extracts page metadata', async () => {
      const response = await sendRequest(PORT, {
        id: 'spa-5',
        type: 'render_spa',
        payload: {
          bundles: [{ id: 'meta-bundle', content: createMockSpaBundle() }],
          url: '/property/123',
          rsxapp: TEST_RSXAPP,
          options: { baseUrl: 'http://localhost', extract_meta: true }
        }
      });

      assertEqual(response.status, 'success', `Expected success: ${JSON.stringify(response.error)}`);
      assertTrue(response.payload.meta.title !== null, 'Should have title');
      assertTrue(response.payload.meta.title.includes('160 Acres'), 'Title should contain property name');
      assertEqual(response.payload.meta.description, 'Premium farmland auction in central Iowa');
      assertEqual(response.payload.meta.og_image, 'https://cdn.example.com/property-photo.jpg');
    });

    // Test 6: Timeout when component never reaches ready
    await test('render_spa times out for stuck component', async () => {
      const response = await sendRequest(PORT, {
        id: 'spa-6',
        type: 'render_spa',
        payload: {
          bundles: [{ id: 'stuck-bundle', content: createMockSpaBundle() }],
          url: '/stuck',
          rsxapp: TEST_RSXAPP,
          options: { baseUrl: 'http://localhost', timeout: 500 }
        }
      });

      assertEqual(response.status, 'error');
      assertEqual(response.error.code, 'RENDER_TIMEOUT');
    });

    // Test 7: Filesystem bundle loading
    await test('render_spa loads bundle from filesystem path', async () => {
      // Write bundle to temp file
      const tmpDir = os.tmpdir();
      const tmpFile = path.join(tmpDir, `test-spa-bundle-${Date.now()}.js`);
      fs.writeFileSync(tmpFile, createMockSpaBundle());

      try {
        const response = await sendRequest(PORT, {
          id: 'spa-7',
          type: 'render_spa',
          payload: {
            bundles: [{ id: 'fs-bundle', path: tmpFile }],
            url: '/',
            rsxapp: TEST_RSXAPP,
            options: { baseUrl: 'http://localhost' }
          }
        });

        assertEqual(response.status, 'success', `Expected success: ${JSON.stringify(response.error)}`);
        assertTrue(response.payload.html.includes('Welcome Home'), 'Should render from filesystem bundle');
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    // Test 8: SSR token in outgoing requests
    await test('render_spa includes SSR token in data fetch requests', async () => {
      receivedSsrToken = null;

      const response = await sendRequest(PORT, {
        id: 'spa-8',
        type: 'render_spa',
        payload: {
          bundles: [{ id: 'token-bundle', content: createMockSpaBundle({ dataFetchUrl: mockDataUrl }) }],
          url: '/data',
          rsxapp: TEST_RSXAPP,
          options: { baseUrl: mockDataUrl, timeout: 5000, ssr_token: 'my-secret-ssr-token' }
        }
      });

      assertEqual(response.status, 'success', `Expected success: ${JSON.stringify(response.error)}`);
      assertEqual(receivedSsrToken, 'my-secret-ssr-token', 'SSR token should be in outgoing request');
    });

    // Test 9: Missing bundle file returns BUNDLE_LOAD_ERROR
    await test('render_spa returns error for missing bundle file', async () => {
      const response = await sendRequest(PORT, {
        id: 'spa-9',
        type: 'render_spa',
        payload: {
          bundles: [{ id: 'missing', path: '/nonexistent/path/bundle.js' }],
          url: '/',
          rsxapp: TEST_RSXAPP,
          options: { baseUrl: 'http://localhost' }
        }
      });

      assertEqual(response.status, 'error');
      assertEqual(response.error.code, 'BUNDLE_LOAD_ERROR');
      assertTrue(response.error.message.includes('not found'), 'Error should mention file not found');
    });

    // Test 10: Protocol validation - missing required fields
    await test('render_spa validates required payload fields', async () => {
      // Missing url
      const response1 = await sendRequest(PORT, {
        id: 'spa-10a',
        type: 'render_spa',
        payload: {
          bundles: [{ id: 'test', content: 'void 0;' }],
          rsxapp: TEST_RSXAPP,
          options: { baseUrl: 'http://localhost' }
        }
      });
      assertEqual(response1.status, 'error');
      assertTrue(response1.error.message.includes('url'), 'Should mention missing url');

      // Missing rsxapp
      const response2 = await sendRequest(PORT, {
        id: 'spa-10b',
        type: 'render_spa',
        payload: {
          bundles: [{ id: 'test', content: 'void 0;' }],
          url: '/',
          options: { baseUrl: 'http://localhost' }
        }
      });
      assertEqual(response2.status, 'error');
      assertTrue(response2.error.message.includes('rsxapp'), 'Should mention missing rsxapp');

      // Missing options.baseUrl
      const response3 = await sendRequest(PORT, {
        id: 'spa-10c',
        type: 'render_spa',
        payload: {
          bundles: [{ id: 'test', content: 'void 0;' }],
          url: '/',
          rsxapp: TEST_RSXAPP,
          options: {}
        }
      });
      assertEqual(response3.status, 'error');
      assertTrue(response3.error.message.includes('baseUrl'), 'Should mention missing baseUrl');
    });

    // Test 11: Bundle caching - same bundles reuse cache
    await test('render_spa caches bundles between requests', async () => {
      // Flush cache
      await sendRequest(PORT, { id: 'flush', type: 'flush_cache', payload: {} });

      // First request
      await sendRequest(PORT, {
        id: 'cache-1',
        type: 'render_spa',
        payload: {
          bundles: [{ id: 'cache-test-spa', content: createMockSpaBundle() }],
          url: '/',
          rsxapp: TEST_RSXAPP,
          options: { baseUrl: 'http://localhost' }
        }
      });

      // Check cache
      const stats = server.stats();
      assertTrue(
        stats.bundle_cache.keys.some(k => k.includes('cache-test-spa')),
        'Cache should contain SPA bundle'
      );

      // Second request should use cache (faster)
      const response2 = await sendRequest(PORT, {
        id: 'cache-2',
        type: 'render_spa',
        payload: {
          bundles: [{ id: 'cache-test-spa', content: createMockSpaBundle() }],
          url: '/about',
          rsxapp: TEST_RSXAPP,
          options: { baseUrl: 'http://localhost' }
        }
      });

      assertEqual(response2.status, 'success');
      assertTrue(response2.payload.html.includes('About Us'), 'Cached bundle should still work');
    });

  } finally {
    await server.stop();
    if (mockDataServer) {
      await new Promise((resolve) => mockDataServer.close(resolve));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`render_spa tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
