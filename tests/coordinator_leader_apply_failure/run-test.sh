#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Coordinator Leader Apply Failure"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/apply_fail_card.jqhtml" \
  "$SCRIPT_DIR/apply_fail_card.js" \
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
echo "A. A leader whose on_loaded() throws settles its followers instead of hanging them"
echo "B. A leader whose on_load() sets this.data = null settles its followers too"
echo "   and fails with an error naming the non-object this.data"
echo "Both: the entry is cleared and a later same-args card becomes a new leader"
echo ""

exit $STATUS
