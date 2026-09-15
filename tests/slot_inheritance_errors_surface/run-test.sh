#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Slot Inheritance Errors Surface"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/sie_bad_parent.jqhtml" \
  "$SCRIPT_DIR/sie_bad_parent.js" \
  "$SCRIPT_DIR/sie_child.jqhtml" \
  "$SCRIPT_DIR/sie_child.js" \
  "$SCRIPT_DIR/sie_orphan.jqhtml" \
  --delay=2 --expect-boot-errors | tee "$OUTPUT_LOG"

STATUS=${PIPESTATUS[0]}

# The harness sets window.testReady itself, so it cannot fail this test on its own.
# The assertions are the gate: a missing summary means the run never got that far -
# which is exactly what a regression that wedges the parent looks like.
if ! grep -q "SUMMARY:" "$OUTPUT_LOG"; then STATUS=1; fi
if grep -q "FAIL:" "$OUTPUT_LOG"; then STATUS=1; fi
rm -f "$OUTPUT_LOG"

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "A. A slot-only child whose parent template throws reports an error naming BOTH the"
echo "   child component and the parent template, and the child ends up stopped"
echo "B. A slot-only template with no parent template and no extends= is an error"
echo "C. Neither failure wedges the root - it reaches ready within 1s"
echo ""

exit $STATUS
