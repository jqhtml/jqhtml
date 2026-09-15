#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Component Replacement Edge Cases"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/edge_first.jqhtml" \
  "$SCRIPT_DIR/edge_second.jqhtml" \
  "$SCRIPT_DIR/edge_thrower.jqhtml" \
  "$SCRIPT_DIR/edge_span.jqhtml" \
  --delay=2 | tee "$OUTPUT_LOG"

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
echo "A. Replacing a component whose element had only component classes removes the"
echo "   class attribute outright - it is never written as class=\"\""
echo "B. A throwing stop() propagates out of .component() and the element keeps its"
echo "   old component: a failed cleanup is never followed by a silent overwrite"
echo "C. A tag mismatch is repaired even with empty inner content, and the new element"
echo "   inherits the old one's attributes AND its jQuery .data()"
echo ""

exit $STATUS
