#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Default Attributes Follow Prototype Chain"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/da_base.jqhtml" \
  "$SCRIPT_DIR/da_base.js" \
  "$SCRIPT_DIR/da_child.jqhtml" \
  "$SCRIPT_DIR/da_child.js" \
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
echo "A. A slot-only JS subclass (class Da_Child extends Da_Base, no extends=) gets the"
echo "   parent <Define>'s class/role/tabindex, not just its template"
echo "B. An invocation tabindex=\"0\" or title=\"\" is SET, so the Define default loses"
echo "C. Both hold for a programmatically created component too"
echo ""

exit $STATUS
