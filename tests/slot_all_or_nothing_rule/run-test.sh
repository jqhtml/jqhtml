#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/card.jqhtml" \
  "$SCRIPT_DIR/pure_slots.jqhtml" \
  "$SCRIPT_DIR/pure_slots.js" \
  --delay=1
