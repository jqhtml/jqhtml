#!/bin/bash

echo "=========================================="
echo "JQHTML Test: .component() Setter Applies to Every Match"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/multi_card.jqhtml" \
  "$SCRIPT_DIR/old_card.jqhtml" \
  "$SCRIPT_DIR/multi_card.js" \
  "$SCRIPT_DIR/old_card.js" \
  "$SCRIPT_DIR/test.js" \
  --delay=1
