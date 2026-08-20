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

exec node "$TESTS_DIR/parallel-test-runner.js" "$@"
