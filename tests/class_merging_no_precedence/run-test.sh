#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/base_card.jqhtml" \
  "$SCRIPT_DIR/base_card.js" \
  "$SCRIPT_DIR/test_container.jqhtml" \
  "$SCRIPT_DIR/test_container.js" \
  --delay=1
