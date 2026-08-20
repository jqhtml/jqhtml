#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/wrapper.jqhtml" \
  "$SCRIPT_DIR/inner.jqhtml" \
  "$SCRIPT_DIR/test_container.jqhtml" \
  "$SCRIPT_DIR/test_container.js" \
  --delay=1
