#!/bin/bash

# Reload Ready Invalidation Test
# Tests that .on('ready') handlers added during reload wait for completion

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TESTER_DIR="$SCRIPT_DIR/../../jqhtml-render-harness"

# Run test
node "$TESTER_DIR/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/test_container.jqhtml" \
  "$SCRIPT_DIR/test_container.js" \
  "$SCRIPT_DIR/reload_test_component.jqhtml" \
  "$SCRIPT_DIR/reload_test_component.js"
