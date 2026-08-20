# JQHTML Testing Guide

## Primary Testing Method: jqhtml-render-harness

**Location:** `/var/www/html/jqhtml/jqhtml-render-harness/`

**This is the ONLY approved way to test JQHTML components unless otherwise instructed.**

### How It Works

The `jqhtml-render-harness` test runner:

1. Compiles `.jqhtml` templates using `jqhtml-compile`
2. Bundles with Webpack (exactly replicating RSpade's production approach)
3. Runs in real Chrome browser via Playwright
4. Outputs console logs and rendered DOM

### Test Directory Structure

All tests live in: `/var/www/html/jqhtml/tests/`

Each test is a self-contained directory:

```
tests/
├── feature_name/
│   ├── test.jqhtml          # Main test template
│   ├── component.jqhtml     # Additional components (if needed)
│   ├── component.js         # JavaScript classes (if needed)
│   ├── run-test.sh          # Test execution script
│   └── README.md            # Test documentation
```

### Running the Full Test Suite

```bash
cd /var/www/html/jqhtml/tests
./run-all-tests.sh
```

`run-all-tests.sh` bootstraps `jqhtml-render-harness`'s dependencies on a fresh
clone if needed, then hands off to `parallel-test-runner.js`, which:

1. Discovers every directory under `tests/` that contains a `run-test.sh`
2. Runs each one **3 times** — once per cache mode: `none`, `data`, `html`
   (exercising JQHTML's stale-while-revalidate caching in each state)
3. Runs up to 8 tests at a time (worker pool), each with a 45s timeout
4. Prints `✓`/`✗` as each run completes, then a summary listing failed tests
5. Determines pass/fail from the **process exit code** of each `run-test.sh`
   (`passed: code === 0`), and exits non-zero overall if anything failed

This is genuinely automated, machine-checkable pass/fail testing — it is not
currently wired into `.github/workflows/ci.yml`, but running it is not merely
a manual/visual exercise (see Test Philosophy below).

### Running a Single Test

Useful for debugging one test in isolation without the parallel runner/other
cache modes:

```bash
cd /var/www/html/jqhtml/tests/feature_name
./run-test.sh
```

### Example: run-test.sh

```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

# Pass all .jqhtml dependencies to test runner
node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/dependency1.jqhtml" \
  "$SCRIPT_DIR/dependency2.jqhtml"
```

### Creating a New Test

1. Create directory: `mkdir tests/your_feature`
2. Add `test.jqhtml` with minimal reproduction
3. Add `run-test.sh` (copy from existing test)
4. Add `README.md` explaining what's being tested
5. Make executable: `chmod +x run-test.sh`
6. Run: `./run-test.sh`

### Test Philosophy

These started as manual demonstration tests, and each test's `README.md` /
console output still reads that way, but the suite as a whole is run through
`./run-all-tests.sh` with automated, machine-checked pass/fail:

- ✅ Living documentation of features
- ✅ Debugging aids (run individually via `run-test.sh` when iterating)
- ✅ Automated pass/fail via `run-all-tests.sh` — exit codes are aggregated
  and the runner exits non-zero if any test fails (see above)
- ❌ NOT part of CI/CD — `.github/workflows/ci.yml` only runs the
  `packages/parser` and `packages/core` unit tests below, not this suite

Pass/fail is driven by each `run-test.sh`'s process exit code (a compile
error or an uncaught crash in the browser fails the run). Older tests mostly
rely on that exit code plus visual inspection of the printed output; newer
tests additionally grep their own captured output for specific assertion
failure markers before exiting non-zero, so check an individual test's
`run-test.sh` to see how strict its automated checks are.

### Parser & Core Unit Tests

Separate from the `tests/` demonstration suite, `packages/parser` and
`packages/core` each have their own Jest unit test suites:

```bash
npm run test:parser   # cd packages/parser && npm test
npm run test:core     # cd packages/core && npm test
```

These are genuine unit tests (e.g. `packages/parser/test/*.test.js`) and are
the tests actually run in `.github/workflows/ci.yml`.

### Reference Tests

- **lifecycle_bottom_up_timing/** - Tests bottom-up on_ready() execution order
- **redrawable_and_scoped_sids/** - Tests $redrawable and $sid behavior
- **js_class_support/** - Tests JavaScript class integration
- **session_storage/** - Standalone browser page exercising session storage
  scoping directly; has no `run-test.sh`, so it is excluded from
  `run-all-tests.sh` and must be opened manually in a browser

See `/var/www/html/jqhtml/tests/CLAUDE.md` for complete test directory documentation.
