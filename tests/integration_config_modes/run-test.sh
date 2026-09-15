#!/bin/bash
echo "=========================================="
echo "JQHTML Test: Integration Config Modes"
echo "=========================================="
echo ""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Fail on any FAIL line or a missing SUMMARY, so a dead test cannot score green.
OUTPUT=$(node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/cfg_child.jqhtml" "$SCRIPT_DIR/cfg_child.js" \
  "$SCRIPT_DIR/cfg_cached.jqhtml" "$SCRIPT_DIR/cfg_cached.js" \
  "$SCRIPT_DIR/cfg_with_id.jqhtml" "$SCRIPT_DIR/cfg_with_id.js" \
  --delay=4 2>&1)
echo "$OUTPUT"
echo "$OUTPUT" | grep -q "FAIL:" && exit 1
echo "$OUTPUT" | grep -q "SUMMARY:" || exit 1
exit 0
