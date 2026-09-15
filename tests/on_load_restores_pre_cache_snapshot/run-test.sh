#!/bin/bash

echo "=========================================="
echo "JQHTML Test: on_load() Restores The Pre-Cache Snapshot"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/snap_list.jqhtml" \
  "$SCRIPT_DIR/snap_list.js" \
  "$SCRIPT_DIR/snap_plain.jqhtml" \
  "$SCRIPT_DIR/snap_plain.js" \
  --delay=5 | tee "$OUTPUT_LOG"

STATUS=${PIPESTATUS[0]}

# The harness sets window.testReady itself, so it cannot fail this test on its own.
# The assertions are the gate: a missing summary means the run never got that far.
if ! grep -q "SUMMARY:" "$OUTPUT_LOG"; then STATUS=1; fi
if grep -q "FAIL:" "$OUTPUT_LOG"; then STATUS=1; fi
rm -f "$OUTPUT_LOG"

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "A. (data mode) A warm-cache instance restarts on_load() from the on_create()"
echo "   state, so an append in on_load() still produces exactly one row"
echo "B. (all modes) load() on a component with no custom on_load() returns false"
echo "   and leaves this.data exactly as on_create() left it"
echo ""

exit $STATUS
