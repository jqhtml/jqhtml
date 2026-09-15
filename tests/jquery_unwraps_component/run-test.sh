#!/bin/bash

echo "=========================================="
echo "JQHTML Test: \$(component) Unwraps to the Root Element"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/unwrap_target.jqhtml" \
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
echo "A. \$(component) returns the component's own jQuery element (same node, length 1)"
echo "B. addClass/attr through \$(component) land on the component's root element"
echo "C. find()/children() traverse the component's DOM"
echo "D. Ordinary \$() arguments (elements, selectors, null) are unaffected"
echo ""

exit $STATUS
