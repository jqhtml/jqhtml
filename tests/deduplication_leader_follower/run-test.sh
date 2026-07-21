#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/user_card.jqhtml" \
  "$SCRIPT_DIR/user_card.js" \
  "$SCRIPT_DIR/dedupe_test.jqhtml" \
  "$SCRIPT_DIR/dedupe_test.js" \
  --delay=1
