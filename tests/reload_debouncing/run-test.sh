#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Fail on any FAIL line or on a missing verdict, so a component that dies during boot
# cannot score green.
OUTPUT=$(node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/reload_debounce_test.jqhtml" \
  "$SCRIPT_DIR/reload_debounce_test.js" \
  --delay=2 2>&1)
echo "$OUTPUT"
echo "$OUTPUT" | grep -q "❌ FAIL" && exit 1
echo "$OUTPUT" | grep -q "✅ PASS: reload() debouncing" || exit 1
exit 0
