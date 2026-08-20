#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/counter.jqhtml" \
  "$SCRIPT_DIR/counter.js" \
  "$SCRIPT_DIR/refresh_test.jqhtml" \
  "$SCRIPT_DIR/refresh_test.js" \
  --delay=2
