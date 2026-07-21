/**
 * Storage module tests
 */

const { SSR_Storage, createStoragePair } = require('../src/storage.js');

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

// ============ SSR_Storage tests ============

test('SSR_Storage: getItem returns null for missing key', () => {
  const storage = new SSR_Storage();
  assertEqual(storage.getItem('missing'), null);
});

test('SSR_Storage: setItem and getItem', () => {
  const storage = new SSR_Storage();
  storage.setItem('key1', 'value1');
  assertEqual(storage.getItem('key1'), 'value1');
});

test('SSR_Storage: setItem converts to string', () => {
  const storage = new SSR_Storage();
  storage.setItem('number', 123);
  assertEqual(storage.getItem('number'), '123');

  storage.setItem('bool', true);
  assertEqual(storage.getItem('bool'), 'true');
});

test('SSR_Storage: removeItem', () => {
  const storage = new SSR_Storage();
  storage.setItem('key1', 'value1');
  storage.removeItem('key1');
  assertEqual(storage.getItem('key1'), null);
});

test('SSR_Storage: clear', () => {
  const storage = new SSR_Storage();
  storage.setItem('key1', 'value1');
  storage.setItem('key2', 'value2');
  storage.clear();
  assertEqual(storage.length, 0);
});

test('SSR_Storage: length', () => {
  const storage = new SSR_Storage();
  assertEqual(storage.length, 0);
  storage.setItem('key1', 'value1');
  assertEqual(storage.length, 1);
  storage.setItem('key2', 'value2');
  assertEqual(storage.length, 2);
});

test('SSR_Storage: key(index)', () => {
  const storage = new SSR_Storage();
  storage.setItem('a', '1');
  storage.setItem('b', '2');
  assertTrue(storage.key(0) === 'a' || storage.key(0) === 'b');
  assertEqual(storage.key(999), null);
});

test('SSR_Storage: _export', () => {
  const storage = new SSR_Storage();
  storage.setItem('key1', 'value1');
  storage.setItem('key2', 'value2');
  const exported = storage._export();
  assertEqual(exported, { key1: 'value1', key2: 'value2' });
});

test('SSR_Storage: _import', () => {
  const storage = new SSR_Storage();
  storage._import({ imported1: 'val1', imported2: 'val2' });
  assertEqual(storage.getItem('imported1'), 'val1');
  assertEqual(storage.getItem('imported2'), 'val2');
});

test('SSR_Storage: _hasData', () => {
  const storage = new SSR_Storage();
  assertTrue(!storage._hasData());
  storage.setItem('key', 'value');
  assertTrue(storage._hasData());
});

// ============ createStoragePair tests ============

test('createStoragePair: returns localStorage and sessionStorage', () => {
  const pair = createStoragePair();
  assertTrue(pair.localStorage instanceof SSR_Storage);
  assertTrue(pair.sessionStorage instanceof SSR_Storage);
});

test('createStoragePair: localStorage and sessionStorage are independent', () => {
  const pair = createStoragePair();
  pair.localStorage.setItem('key', 'local');
  pair.sessionStorage.setItem('key', 'session');
  assertEqual(pair.localStorage.getItem('key'), 'local');
  assertEqual(pair.sessionStorage.getItem('key'), 'session');
});

test('createStoragePair: exportAll', () => {
  const pair = createStoragePair();
  pair.localStorage.setItem('lkey', 'lval');
  pair.sessionStorage.setItem('skey', 'sval');

  const exported = pair.exportAll();
  assertEqual(exported.localStorage, { lkey: 'lval' });
  assertEqual(exported.sessionStorage, { skey: 'sval' });
});

// ============ Summary ============

console.log('\n' + '='.repeat(50));
console.log(`Storage tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
