#!/bin/bash

echo "=========================================="
echo "JQHTML Test: HTML Cache Replay - Scoped IDs and Child Stop"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/hc_card.jqhtml" \
  "$SCRIPT_DIR/hc_card.js" \
  "$SCRIPT_DIR/hc_child.jqhtml" \
  "$SCRIPT_DIR/hc_child.js" \
  --delay=5 | tee "$OUTPUT_LOG"

STATUS=${PIPESTATUS[0]}

# The harness sets window.testReady itself, so it cannot fail this test on its own.
# The assertions are the gate: a missing summary means the run never got that far.
if ! grep -q "SUMMARY:" "$OUTPUT_LOG"; then STATUS=1; fi
if grep -q "FAIL:" "$OUTPUT_LOG"; then STATUS=1; fi
rm -f "$OUTPUT_LOG"

echo ""
echo "=========================================="
echo "Expected Behavior ('html' mode; the other two modes instant-pass):"
echo "=========================================="
echo ""
echo "A. Two instances hydrated from ONE snapshot share no scoped id, and each"
echo "   \$sid() resolves to its own element - both during the cached render and after ready()"
echo "B. A reload that injects cached HTML over a live subtree stops the children it"
echo "   replaces (on_stop fires) and leaves no stale entries in _dom_children"
echo ""

exit $STATUS
