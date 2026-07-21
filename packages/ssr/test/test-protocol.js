/**
 * Protocol module tests
 */

const {
  ErrorCodes,
  parseRequest,
  successResponse,
  errorResponse,
  renderResponse,
  pingResponse,
  flushCacheResponse,
  MessageBuffer
} = require('../src/protocol.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}`);
    console.log(`   ${err.message}`);
    failed++;
  }
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

// ============ parseRequest tests ============

test('parseRequest: valid ping request', () => {
  const result = parseRequest('{"id":"test-1","type":"ping","payload":{}}');
  assertTrue(result.ok);
  assertEqual(result.request.id, 'test-1');
  assertEqual(result.request.type, 'ping');
});

test('parseRequest: valid render request', () => {
  const request = {
    id: 'render-1',
    type: 'render',
    payload: {
      bundles: [{ id: 'vendor', content: 'console.log("hi")' }],
      component: 'Test_Component',
      args: { foo: 'bar' },
      options: { baseUrl: 'https://example.com', timeout: 5000 }
    }
  };
  const result = parseRequest(JSON.stringify(request));
  assertTrue(result.ok);
  assertEqual(result.request.id, 'render-1');
  assertEqual(result.request.payload.component, 'Test_Component');
});

test('parseRequest: invalid JSON', () => {
  const result = parseRequest('not json');
  assertTrue(!result.ok);
  assertEqual(result.error.code, ErrorCodes.PARSE_ERROR);
});

test('parseRequest: missing id', () => {
  const result = parseRequest('{"type":"ping","payload":{}}');
  assertTrue(!result.ok);
  assertEqual(result.error.code, ErrorCodes.PARSE_ERROR);
  assertTrue(result.error.message.includes('id'));
});

test('parseRequest: missing type', () => {
  const result = parseRequest('{"id":"1","payload":{}}');
  assertTrue(!result.ok);
  assertEqual(result.error.code, ErrorCodes.PARSE_ERROR);
  assertTrue(result.error.message.includes('type'));
});

test('parseRequest: invalid type', () => {
  const result = parseRequest('{"id":"1","type":"invalid","payload":{}}');
  assertTrue(!result.ok);
  assertEqual(result.error.code, ErrorCodes.PARSE_ERROR);
  assertTrue(result.error.message.includes('invalid'));
});

test('parseRequest: render missing bundles', () => {
  const request = {
    id: '1',
    type: 'render',
    payload: {
      component: 'Test',
      options: { baseUrl: 'http://localhost' }
    }
  };
  const result = parseRequest(JSON.stringify(request));
  assertTrue(!result.ok);
  assertTrue(result.error.message.includes('bundles'));
});

test('parseRequest: render missing baseUrl', () => {
  const request = {
    id: '1',
    type: 'render',
    payload: {
      bundles: [{ id: 'test', content: 'x' }],
      component: 'Test',
      options: {}
    }
  };
  const result = parseRequest(JSON.stringify(request));
  assertTrue(!result.ok);
  assertTrue(result.error.message.includes('baseUrl'));
});

// ============ Response tests ============

test('successResponse: includes newline', () => {
  const response = successResponse('id-1', { data: 'test' });
  assertTrue(response.endsWith('\n'));
  const parsed = JSON.parse(response);
  assertEqual(parsed.status, 'success');
  assertEqual(parsed.id, 'id-1');
});

test('errorResponse: includes code and message', () => {
  const response = errorResponse('id-2', ErrorCodes.RENDER_ERROR, 'Something broke', 'stack trace');
  const parsed = JSON.parse(response);
  assertEqual(parsed.status, 'error');
  assertEqual(parsed.error.code, ErrorCodes.RENDER_ERROR);
  assertEqual(parsed.error.message, 'Something broke');
  assertEqual(parsed.error.stack, 'stack trace');
});

test('renderResponse: includes html, cache, timing', () => {
  const response = renderResponse(
    'render-1',
    '<div>Hello</div>',
    { localStorage: {}, sessionStorage: {} },
    { total_ms: 100, bundle_load_ms: 10, render_ms: 90 }
  );
  const parsed = JSON.parse(response);
  assertEqual(parsed.payload.html, '<div>Hello</div>');
  assertEqual(parsed.payload.timing.total_ms, 100);
});

test('pingResponse: includes uptime', () => {
  const response = pingResponse('ping-1', 12345);
  const parsed = JSON.parse(response);
  assertEqual(parsed.payload.uptime_ms, 12345);
});

// ============ MessageBuffer tests ============

test('MessageBuffer: single complete message', () => {
  const buffer = new MessageBuffer();
  const messages = buffer.push('{"id":"1"}\n');
  assertEqual(messages.length, 1);
  assertEqual(messages[0], '{"id":"1"}');
});

test('MessageBuffer: multiple messages in one chunk', () => {
  const buffer = new MessageBuffer();
  const messages = buffer.push('{"id":"1"}\n{"id":"2"}\n');
  assertEqual(messages.length, 2);
  assertEqual(messages[0], '{"id":"1"}');
  assertEqual(messages[1], '{"id":"2"}');
});

test('MessageBuffer: split across chunks', () => {
  const buffer = new MessageBuffer();
  let messages = buffer.push('{"id":');
  assertEqual(messages.length, 0);
  assertTrue(buffer.hasIncomplete());

  messages = buffer.push('"1"}\n');
  assertEqual(messages.length, 1);
  assertEqual(messages[0], '{"id":"1"}');
});

test('MessageBuffer: empty lines ignored', () => {
  const buffer = new MessageBuffer();
  const messages = buffer.push('\n\n{"id":"1"}\n\n');
  assertEqual(messages.length, 1);
});

// ============ Summary ============

console.log('\n' + '='.repeat(50));
console.log(`Protocol tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
