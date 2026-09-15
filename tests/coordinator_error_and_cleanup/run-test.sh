#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Coordinator Error and Cleanup"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/coord_card.jqhtml" \
  "$SCRIPT_DIR/coord_card.js" \
  "$SCRIPT_DIR/coord_parent.jqhtml" \
  "$SCRIPT_DIR/coord_parent.js" \
  --delay=3 --expect-boot-errors | tee "$OUTPUT_LOG"

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
echo "A. A leader whose on_load() rejects settles its followers instead of hanging them"
echo "B. The next component with that key becomes a new leader and runs on_load()"
echo "C. A leader with no followers leaves no coordination entry behind"
echo "D. A follower whose args changed mid-load still receives the leader's data"
echo "E. Leader and followers each own their data object"
echo ""

exit $STATUS
