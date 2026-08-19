#!/bin/bash
echo "=========================================="
echo "JQHTML Test: Integration Config Modes"
echo "=========================================="
echo ""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/cfg_child.jqhtml" "$SCRIPT_DIR/cfg_child.js" \
  "$SCRIPT_DIR/cfg_cached.jqhtml" "$SCRIPT_DIR/cfg_cached.js" \
  "$SCRIPT_DIR/cfg_with_id.jqhtml" "$SCRIPT_DIR/cfg_with_id.js" \
  --delay=4
