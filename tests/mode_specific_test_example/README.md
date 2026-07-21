# Mode-Specific Test Example

This test demonstrates how to write tests that only apply to specific cache modes.

## The Pattern

Tests can declare which cache modes they apply to using a `VALID_MODES` array:

```javascript
// Define which cache modes this test applies to
const VALID_MODES = ['data'];  // Only runs in data cache mode
```

Then at the start of `on_ready()`, check if the current mode is valid:

```javascript
async on_ready() {
  const cacheMode = window.__JQHTML_TEST_CACHE_MODE__ || 'none';

  if (!VALID_MODES.includes(cacheMode)) {
    console.log(`[SKIP] Test only applies to modes: ${VALID_MODES.join(', ')}`);
    window.testPassed = true;  // Instant pass
    return;
  }

  // Run actual test assertions...
}
```

## Valid Mode Declarations

- `['none']` - Only runs without caching
- `['data']` - Only runs in data cache mode
- `['html']` - Only runs in HTML cache mode
- `['none', 'data']` - Runs in no-cache and data modes
- `['data', 'html']` - Runs in both cache modes
- `['none', 'data', 'html']` - Runs in all modes (same as no mode check)

## How the Test Runner Works

1. `parallel-test-runner.js` runs each test 3 times (once per mode)
2. Each run sets `JQHTML_TEST_CACHE_MODE` environment variable
3. `test-runner.js` reads the env var and injects cache configuration
4. Test code accesses `window.__JQHTML_TEST_CACHE_MODE__` to check current mode

## When to Use Mode-Specific Tests

- **ORM class serialization tests** → `['data']` only (HTML mode preserves classes)
- **HTML snapshot timing tests** → `['html']` only
- **`this.data` proxy restriction tests** → `['html']` only (current implementation)
- **Basic lifecycle tests** → All modes (no restriction needed)

## Test Results

When run by `parallel-test-runner.js`:

```
Running 50 tests × 3 cache modes = 150 total test runs

Results by cache mode:
  none : 50/50 passed
  data : 50/50 passed
  html : 50/50 passed
```

Mode-specific tests that skip show as passed in their non-applicable modes.
