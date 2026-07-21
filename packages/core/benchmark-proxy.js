#!/usr/bin/env node

/**
 * Benchmark: Proxy overhead for DOM access restriction
 *
 * Tests performance of three approaches:
 * 1. Direct access (baseline)
 * 2. Property hiding (Option 2)
 * 3. Proxy (Option 1)
 */

const ITERATIONS = 5000;

// Simulate a component with DOM properties
class MockComponent {
    constructor() {
        this.$ = { addClass: () => {}, css: () => {}, find: () => {} };
        this.id = (name) => ({ some: 'component' });
        this.$id = (name) => ({ addClass: () => {} });
        this.args = { user_id: 123 };
        this.data = {};
    }
}

// ============================================================================
// Test 1: Direct Access (Baseline)
// ============================================================================
function test_direct_access() {
    const components = [];

    const start = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
        const comp = new MockComponent();
        components.push(comp);

        // Access properties directly
        comp.$.addClass('test');
        comp.$id('btn').addClass('active');
        const child = comp.id('child');
        comp.data.value = i;
    }

    const end = performance.now();
    return end - start;
}

// ============================================================================
// Test 2: Property Hiding (Option 2)
// ============================================================================
function test_property_hiding() {
    const components = [];

    const start = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
        const comp = new MockComponent();
        components.push(comp);

        // Save properties
        const saved_$ = comp.$;
        const saved_id = comp.id;
        const saved_$id = comp.$id;

        // Hide properties during on_load
        comp.$ = new Proxy({}, {
            get() { throw new Error('Cannot access this.$'); }
        });
        comp.id = () => { throw new Error('Cannot access this.id()'); };
        comp.$id = () => { throw new Error('Cannot access this.$id()'); };

        // Simulate on_load accessing allowed properties
        comp.data.value = i;
        const args = comp.args;

        // Restore properties
        comp.$ = saved_$;
        comp.id = saved_id;
        comp.$id = saved_$id;

        // Now access DOM properties
        comp.$.addClass('test');
        comp.$id('btn').addClass('active');
        const child = comp.id('child');
    }

    const end = performance.now();
    return end - start;
}

// ============================================================================
// Test 3: Proxy (Option 1)
// ============================================================================
function test_proxy() {
    const components = [];

    const start = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
        const comp = new MockComponent();
        components.push(comp);

        // Create proxy during on_load
        const restricted_this = new Proxy(comp, {
            get(target, prop) {
                if (prop === '$' || prop === 'id' || prop === '$id') {
                    throw new Error(`Cannot access this.${String(prop)} during on_load()`);
                }
                return target[prop];
            },
            set(target, prop, value) {
                if (prop === '$' || prop === 'id' || prop === '$id') {
                    throw new Error(`Cannot modify this.${String(prop)} during on_load()`);
                }
                target[prop] = value;
                return true;
            }
        });

        // Simulate on_load accessing allowed properties through proxy
        restricted_this.data.value = i;
        const args = restricted_this.args;

        // After on_load, access DOM properties directly
        comp.$.addClass('test');
        comp.$id('btn').addClass('active');
        const child = comp.id('child');
    }

    const end = performance.now();
    return end - start;
}

// ============================================================================
// Test 4: Proxy with .bind() approach
// ============================================================================
function test_proxy_bind() {
    const components = [];

    const start = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
        const comp = new MockComponent();
        components.push(comp);

        // Simulate on_load function
        const on_load = function() {
            this.data.value = i;
            const args = this.args;
        };

        // Create proxy for binding
        const restricted_this = new Proxy(comp, {
            get(target, prop) {
                if (prop === '$' || prop === 'id' || prop === '$id') {
                    throw new Error(`Cannot access this.${String(prop)} during on_load()`);
                }
                return target[prop];
            }
        });

        // Call on_load with restricted this
        on_load.call(restricted_this);

        // After on_load, access DOM properties directly
        comp.$.addClass('test');
        comp.$id('btn').addClass('active');
        const child = comp.id('child');
    }

    const end = performance.now();
    return end - start;
}

// ============================================================================
// Run Benchmarks
// ============================================================================

console.log(`Benchmarking DOM access restriction approaches (${ITERATIONS} iterations)\n`);

// Warmup
test_direct_access();
test_property_hiding();
test_proxy();
test_proxy_bind();

// Actual tests
const results = {
    direct: test_direct_access(),
    hiding: test_property_hiding(),
    proxy: test_proxy(),
    proxy_bind: test_proxy_bind()
};

console.log('Results:');
console.log('========');
console.log(`Direct Access (baseline):     ${results.direct.toFixed(2)}ms`);
console.log(`Property Hiding (Option 2):   ${results.hiding.toFixed(2)}ms  (${(results.hiding / results.direct).toFixed(2)}x baseline)`);
console.log(`Proxy (Option 1):             ${results.proxy.toFixed(2)}ms  (${(results.proxy / results.direct).toFixed(2)}x baseline)`);
console.log(`Proxy with .bind():           ${results.proxy_bind.toFixed(2)}ms  (${(results.proxy_bind / results.direct).toFixed(2)}x baseline)`);

console.log('\nOverhead per component:');
console.log(`Property Hiding: ${((results.hiding - results.direct) / ITERATIONS).toFixed(4)}ms`);
console.log(`Proxy:           ${((results.proxy - results.direct) / ITERATIONS).toFixed(4)}ms`);
console.log(`Proxy with bind: ${((results.proxy_bind - results.direct) / ITERATIONS).toFixed(4)}ms`);

console.log('\nConclusions:');
if (results.proxy < results.hiding * 1.1) {
    console.log('✅ Proxy overhead is negligible (within 10% of property hiding)');
    console.log('   Recommendation: Use Option 1 (Proxy) for better developer experience');
} else if (results.hiding < results.proxy * 0.5) {
    console.log('⚠️  Property hiding is significantly faster');
    console.log('   Recommendation: Use Option 2 (Property Hiding) for performance');
} else {
    console.log('📊 Both approaches have similar performance');
    console.log('   Recommendation: Choose based on developer experience preference');
}
