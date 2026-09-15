#!/bin/bash

echo "=========================================="
echo "JQHTML Test: HTML Cache - Children Without on_load, Reload With Unchanged Data"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/hcw_leaf.jqhtml" \
  "$SCRIPT_DIR/hcw_parent.jqhtml" \
  "$SCRIPT_DIR/hcw_card.jqhtml" \
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
echo "A. A dynamic parent whose child has no on_load() still reaches ready() (and"
echo "   writes its html snapshot) instead of waiting forever for a post-load render"
echo "   that child will never have"
echo "B. A reload() that injects cached html and then loads unchanged data re-renders"
echo "   anyway: live child components, no stopped markup left behind"
echo ""

exit $STATUS
