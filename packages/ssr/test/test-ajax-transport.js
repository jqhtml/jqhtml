/**
 * $.ajaxTransport integration tests
 *
 * Tests that the custom jQuery ajaxTransport makes real HTTP requests
 * via Node's fetch() instead of jsdom's limited XMLHttpRequest.
 */

const http = require('http');
const { SSREnvironment } = require('../src/environment.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return fn().then(() => {
    console.log(`\u2705 ${name}`);
    passed++;
  }).catch((err) => {
    console.log(`\u274c ${name}`);
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
 * Create a mock HTTP server that records requests and returns configurable responses
 */
function createMockServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function closeMockServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function runTests() {
  console.log('Ajax Transport Tests\n');

  // Test 1: GET request via $.ajax()
  await test('$.ajax() GET request makes real HTTP call', async () => {
    let receivedRequest = null;

    const { server, port, baseUrl } = await createMockServer((req, res) => {
      receivedRequest = { method: req.method, url: req.url };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'hello from server' }));
    });

    const env = new SSREnvironment({ baseUrl, timeout: 5000 });
    try {
      env.init();

      const $ = global.$;
      const result = await new Promise((resolve, reject) => {
        $.ajax({
          url: baseUrl + '/api/test',
          method: 'GET',
          dataType: 'json',
          success: resolve,
          error: (jqXHR, textStatus, errorThrown) => reject(new Error(`Ajax failed: ${textStatus} ${errorThrown}`))
        });
      });

      assertTrue(receivedRequest !== null, 'Server should have received a request');
      assertEqual(receivedRequest.method, 'GET');
      assertEqual(receivedRequest.url, '/api/test');
      assertEqual(result.message, 'hello from server');
    } finally {
      env.destroy();
      await closeMockServer(server);
    }
  });

  // Test 2: POST request with JSON body
  await test('$.ajax() POST with JSON body works', async () => {
    let receivedBody = '';

    const { server, port, baseUrl } = await createMockServer((req, res) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        receivedBody = body;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      });
    });

    const env = new SSREnvironment({ baseUrl, timeout: 5000 });
    try {
      env.init();

      const $ = global.$;
      await new Promise((resolve, reject) => {
        $.ajax({
          url: baseUrl + '/api/save',
          method: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({ name: 'test', value: 42 }),
          dataType: 'json',
          success: resolve,
          error: (jqXHR, textStatus) => reject(new Error(`Ajax failed: ${textStatus}`))
        });
      });

      const parsed = JSON.parse(receivedBody);
      assertEqual(parsed.name, 'test');
      assertEqual(parsed.value, 42);
    } finally {
      env.destroy();
      await closeMockServer(server);
    }
  });

  // Test 3: URL resolution - relative URL resolves against baseUrl
  await test('Relative URLs resolved against baseUrl', async () => {
    let receivedUrl = null;

    const { server, port, baseUrl } = await createMockServer((req, res) => {
      receivedUrl = req.url;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });

    const env = new SSREnvironment({ baseUrl, timeout: 5000 });
    try {
      env.init();

      const $ = global.$;
      await new Promise((resolve, reject) => {
        $.ajax({
          url: '/api/data',
          method: 'GET',
          dataType: 'json',
          success: resolve,
          error: (jqXHR, textStatus) => reject(new Error(`Ajax failed: ${textStatus}`))
        });
      });

      assertEqual(receivedUrl, '/api/data');
    } finally {
      env.destroy();
      await closeMockServer(server);
    }
  });

  // Test 4: SSR token included in requests
  await test('SSR token header included when configured', async () => {
    let receivedHeaders = {};

    const { server, port, baseUrl } = await createMockServer((req, res) => {
      receivedHeaders = req.headers;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });

    const env = new SSREnvironment({ baseUrl, timeout: 5000, ssrToken: 'test-secret-token' });
    try {
      env.init();

      const $ = global.$;
      await new Promise((resolve, reject) => {
        $.ajax({
          url: baseUrl + '/api/data',
          method: 'GET',
          dataType: 'json',
          success: resolve,
          error: (jqXHR, textStatus) => reject(new Error(`Ajax failed: ${textStatus}`))
        });
      });

      assertEqual(receivedHeaders['x-ssr-token'], 'test-secret-token');
    } finally {
      env.destroy();
      await closeMockServer(server);
    }
  });

  // Test 5: Auth headers are stripped
  await test('Authorization and Cookie headers stripped', async () => {
    let receivedHeaders = {};

    const { server, port, baseUrl } = await createMockServer((req, res) => {
      receivedHeaders = req.headers;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });

    const env = new SSREnvironment({ baseUrl, timeout: 5000 });
    try {
      env.init();

      const $ = global.$;
      await new Promise((resolve, reject) => {
        $.ajax({
          url: baseUrl + '/api/data',
          method: 'GET',
          dataType: 'json',
          headers: {
            'Authorization': 'Bearer secret',
            'Cookie': 'session=abc123'
          },
          success: resolve,
          error: (jqXHR, textStatus) => reject(new Error(`Ajax failed: ${textStatus}`))
        });
      });

      assertTrue(!receivedHeaders['authorization'], 'Authorization header should be stripped');
      assertTrue(!receivedHeaders['cookie'], 'Cookie header should be stripped');
    } finally {
      env.destroy();
      await closeMockServer(server);
    }
  });

  // Test 6: Error handling - HTTP error status
  await test('$.ajax() handles HTTP error responses', async () => {
    const { server, port, baseUrl } = await createMockServer((req, res) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    });

    const env = new SSREnvironment({ baseUrl, timeout: 5000 });
    try {
      env.init();

      const $ = global.$;
      let errorCaught = false;
      let errorStatus = null;

      await new Promise((resolve) => {
        $.ajax({
          url: baseUrl + '/api/fail',
          method: 'GET',
          dataType: 'json',
          success: () => resolve(),
          error: (jqXHR, textStatus) => {
            errorCaught = true;
            errorStatus = jqXHR.status;
            resolve();
          }
        });
      });

      assertTrue(errorCaught, 'Should have caught an error');
      assertEqual(errorStatus, 500);
    } finally {
      env.destroy();
      await closeMockServer(server);
    }
  });

  // Test 7: Multiple concurrent $.ajax() calls
  await test('Multiple concurrent $.ajax() calls work', async () => {
    let requestCount = 0;

    const { server, port, baseUrl } = await createMockServer((req, res) => {
      requestCount++;
      const id = req.url.split('/').pop();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: parseInt(id) }));
    });

    const env = new SSREnvironment({ baseUrl, timeout: 5000 });
    try {
      env.init();

      const $ = global.$;
      const promises = [1, 2, 3].map(id =>
        new Promise((resolve, reject) => {
          $.ajax({
            url: `${baseUrl}/api/item/${id}`,
            method: 'GET',
            dataType: 'json',
            success: resolve,
            error: (jqXHR, textStatus) => reject(new Error(`Ajax failed for ${id}: ${textStatus}`))
          });
        })
      );

      const results = await Promise.all(promises);
      assertEqual(requestCount, 3);
      assertEqual(results[0].id, 1);
      assertEqual(results[1].id, 2);
      assertEqual(results[2].id, 3);
    } finally {
      env.destroy();
      await closeMockServer(server);
    }
  });

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Ajax transport tests: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
