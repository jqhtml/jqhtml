#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/interpolated_sid_precedence_test.jqhtml" \
  "$SCRIPT_DIR/interpolated_sid_precedence_test.js" \
  --delay=1
