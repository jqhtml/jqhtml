#!/usr/bin/env node

/**
 * Benchmark: Lifecycle Method Protection Approaches
 *
 * Compares Option 1 (direct property storage) vs Option 2 (WeakMap storage)
 * for protecting lifecycle methods from manual invocation.
 *
 * Test simulates real-world usage:
 * - Creates components with 3 lifecycle methods
 * - Protects methods, calls them (authorized), then component is eventually evicted
 * - Maintains LRU cache of 50 components (simulating page with many components)
 * - Measures throughput over 5 seconds per approach
 */

const DURATION_MS = 5000;
const LRU_SIZE = 50;

// =============================================================================
// Base class (shared between both options)
// =============================================================================

class BaseComponent {
  constructor(id) {
    this.id = id;
    this.data = {};
  }

  on_create() {
    this.data.created = true;
    return { created: true, id: this.id };
  }

  on_load() {
    this.data.loaded = Date.now();
    return { loaded: this.data.loaded, id: this.id };
  }

  on_ready() {
    this.data.ready = true;
    return { ready: true, id: this.id };
  }
}

// =============================================================================
// Option 1: Direct Property Storage
// =============================================================================

class Option1Component extends BaseComponent {
  _protect_lifecycle_methods() {
    const methods = ['on_create', 'on_load', 'on_ready'];

    for (const name of methods) {
      const original = this[name];
      if (!original) continue;

      const self = this;
      this[`__impl_${name}`] = original;
      this[name] = {
        [name](...args) {
          if (!self.__lifecycle_authorized) {
            throw new Error(`[JQHTML] ${name}() cannot be called manually.`);
          }
          return self[`__impl_${name}`].apply(self, args);
        }
      }[name];
    }
  }

  _call_lifecycle(name) {
    this.__lifecycle_authorized = true;
    try {
      return this[name]();
    } finally {
      this.__lifecycle_authorized = false;
    }
  }
}

// =============================================================================
// Option 2: WeakMap Storage
// =============================================================================

const lifecycle_impls = new WeakMap();

class Option2Component extends BaseComponent {
  _protect_lifecycle_methods() {
    const impls = {};
    const methods = ['on_create', 'on_load', 'on_ready'];

    for (const name of methods) {
      const original = this[name];
      if (!original) continue;

      impls[name] = original;
      const self = this;
      this[name] = {
        [name](...args) {
          if (!self.__lifecycle_authorized) {
            throw new Error(`[JQHTML] ${name}() cannot be called manually.`);
          }
          return lifecycle_impls.get(self)[name].apply(self, args);
        }
      }[name];
    }

    lifecycle_impls.set(this, impls);
  }

  _call_lifecycle(name) {
    this.__lifecycle_authorized = true;
    try {
      return this[name]();
    } finally {
      this.__lifecycle_authorized = false;
    }
  }
}

// =============================================================================
// LRU Cache (simple array-based)
// =============================================================================

class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.items = [];
  }

  add(item) {
    if (this.items.length >= this.maxSize) {
      // Evict oldest (first) item - dereference for GC
      this.items.shift();
    }
    this.items.push(item);
  }

  clear() {
    this.items = [];
  }
}

// =============================================================================
// Benchmark Runner
// =============================================================================

function runBenchmark(name, ComponentClass, durationMs) {
  const cache = new LRUCache(LRU_SIZE);
  let operationCount = 0;
  let componentId = 0;

  const startTime = Date.now();
  const endTime = startTime + durationMs;

  while (Date.now() < endTime) {
    // Create component
    const component = new ComponentClass(componentId++);

    // Protect lifecycle methods
    component._protect_lifecycle_methods();

    // Call all lifecycle methods (simulating boot sequence)
    const result1 = component._call_lifecycle('on_create');
    const result2 = component._call_lifecycle('on_load');
    const result3 = component._call_lifecycle('on_ready');

    // Verify results (ensure optimizer doesn't skip work)
    if (!result1.created || !result2.loaded || !result3.ready) {
      throw new Error('Unexpected result');
    }

    // Add to LRU cache (old components get evicted/dereferenced)
    cache.add(component);

    operationCount++;
  }

  const actualDuration = Date.now() - startTime;
  cache.clear();

  return {
    name,
    operations: operationCount,
    durationMs: actualDuration,
    opsPerSecond: Math.round(operationCount / (actualDuration / 1000)),
    componentsCreated: componentId
  };
}

// =============================================================================
// Main
// =============================================================================

console.log('='.repeat(70));
console.log('Lifecycle Method Protection Benchmark');
console.log('='.repeat(70));
console.log('');
console.log(`Duration per test: ${DURATION_MS / 1000} seconds`);
console.log(`LRU cache size: ${LRU_SIZE} components`);
console.log('');
console.log('Each operation: create component → protect 3 methods → call 3 methods → cache');
console.log('');

// Warm up (let JIT compile)
console.log('Warming up JIT...');
runBenchmark('warmup1', Option1Component, 1000);
runBenchmark('warmup2', Option2Component, 1000);

// Force GC if available
if (global.gc) {
  global.gc();
  console.log('GC triggered');
}

console.log('');
console.log('Running benchmarks...');
console.log('');

// Run actual benchmarks
const results = [];

console.log(`[Option 1] Direct Property Storage - running ${DURATION_MS / 1000}s...`);
results.push(runBenchmark('Option 1: Direct Property', Option1Component, DURATION_MS));

// Force GC between tests if available
if (global.gc) {
  global.gc();
}

console.log(`[Option 2] WeakMap Storage - running ${DURATION_MS / 1000}s...`);
results.push(runBenchmark('Option 2: WeakMap', Option2Component, DURATION_MS));

// =============================================================================
// Results
// =============================================================================

console.log('');
console.log('='.repeat(70));
console.log('RESULTS');
console.log('='.repeat(70));
console.log('');

for (const result of results) {
  console.log(`${result.name}:`);
  console.log(`  Operations:     ${result.operations.toLocaleString()}`);
  console.log(`  Ops/second:     ${result.opsPerSecond.toLocaleString()}`);
  console.log(`  Duration:       ${result.durationMs}ms`);
  console.log('');
}

// Comparison
const option1 = results[0];
const option2 = results[1];
const diff = ((option1.opsPerSecond - option2.opsPerSecond) / option2.opsPerSecond * 100).toFixed(2);
const faster = option1.opsPerSecond > option2.opsPerSecond ? 'Option 1' : 'Option 2';
const slower = option1.opsPerSecond > option2.opsPerSecond ? 'Option 2' : 'Option 1';

console.log('='.repeat(70));
console.log('COMPARISON');
console.log('='.repeat(70));
console.log('');
console.log(`${faster} is ${Math.abs(diff)}% faster than ${slower}`);
console.log('');

// Practical impact
const avgOpsPerComponent = 3; // 3 lifecycle calls per component
const typicalPageComponents = 100;
const option1TimePerOp = 1000000 / option1.opsPerSecond; // microseconds
const option2TimePerOp = 1000000 / option2.opsPerSecond; // microseconds
const option1PageTime = (option1TimePerOp * typicalPageComponents).toFixed(2);
const option2PageTime = (option2TimePerOp * typicalPageComponents).toFixed(2);

console.log('Practical impact (100 components on page):');
console.log(`  Option 1: ~${option1PageTime} microseconds total`);
console.log(`  Option 2: ~${option2PageTime} microseconds total`);
console.log(`  Difference: ~${Math.abs(option1PageTime - option2PageTime).toFixed(2)} microseconds`);
console.log('');
console.log('(Both are negligible - choose based on code clarity)');
console.log('');

// Run with: node lifecycle-protection-benchmark.js
// For accurate GC stats: node --expose-gc lifecycle-protection-benchmark.js
