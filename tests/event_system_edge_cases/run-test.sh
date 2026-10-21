#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Event System Edge Cases"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/ese_plain.jqhtml" \
  "$SCRIPT_DIR/ese_gated.jqhtml" \
  "$SCRIPT_DIR/ese_gated.js" \
  "$SCRIPT_DIR/ese_parent.jqhtml" \
  --delay=3
HARNESS_STATUS=$?

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "A. A once() handler fires once when an earlier handler re-triggers its event"
echo "B. A once() handler that re-triggers its own event fires once"
echo "C. Nested dispatch keeps registration order; only the duplicate once() call is gone"
echo "D. Repeated child-ready waits leave no 'ready' or 'stop' handlers on the children"
echo "E. Handlers receive the same this and arguments as before the change"
echo ""

# Propagate the harness verdict (VERDICT: PASS/FAIL) as this script's exit code.
exit $HARNESS_STATUS
