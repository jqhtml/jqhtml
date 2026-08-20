#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/custom_input.jqhtml" \
  "$SCRIPT_DIR/custom_input.js" \
  "$SCRIPT_DIR/test_container.jqhtml" \
  "$SCRIPT_DIR/test_container.js" \
  --delay=1
