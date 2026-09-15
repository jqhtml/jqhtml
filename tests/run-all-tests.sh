#!/bin/bash

# JQHTML Test Runner
# Runs all tests in parallel using the Node.js parallel test runner

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Bootstrap shared test tooling on fresh clones (internally these deps are vendored in git)
TESTER_DIR="$TESTS_DIR/../jqhtml-render-harness"
if [ -d "$TESTER_DIR" ] && [ ! -d "$TESTER_DIR/node_modules" ]; then
  echo "First run: installing test tooling dependencies in jqhtml-render-harness/..."
  (cd "$TESTER_DIR" && npm install --no-audit --no-fund)
fi

# Engines: every browser test runs on each engine in JQHTML_BROWSERS (default
# "chromium firefox webkit"). --browser=NAME (or JQHTML_BROWSER=NAME) narrows to one,
# which is what the edit/run loop wants. Each engine takes about 2.5 minutes (all three
# ~7): parallel-test-runner.js runs one shared browser per engine and the harness caches
# webpack bundles, so a run is no longer 300 browser launches and 300 bundles.
ENGINES="${JQHTML_BROWSERS:-chromium firefox webkit}"
[ -n "${JQHTML_BROWSER:-}" ] && ENGINES="$JQHTML_BROWSER"
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --browser=*) ENGINES="${arg#--browser=}" ;;
    *) ARGS+=("$arg") ;;
  esac
done

# Fail before any test starts if a needed browser build is missing (prints how to install).
(cd "$TESTER_DIR" && node check-browsers.js $ENGINES) || exit 1

STATUS=0
for engine in $ENGINES; do
  echo
  echo "=== Browser suite on $engine ==="
  JQHTML_BROWSER="$engine" node "$TESTS_DIR/parallel-test-runner.js" "${ARGS[@]}" || STATUS=1
done
exit $STATUS
