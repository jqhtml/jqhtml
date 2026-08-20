#!/bin/bash
echo "=========================================="
echo "JQHTML Test: Cache Key Content Serialization"
echo "=========================================="
echo ""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/ck_child.jqhtml" "$SCRIPT_DIR/ck_child.js" \
  --delay=3
