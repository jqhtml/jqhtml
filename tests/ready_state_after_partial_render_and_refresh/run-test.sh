#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Ready State After Partial Render and Refresh"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/rs_parent.jqhtml" \
  "$SCRIPT_DIR/rs_parent.js" \
  "$SCRIPT_DIR/rs_poller.jqhtml" \
  "$SCRIPT_DIR/rs_poller.js" \
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
echo "A. render(sid) delegates to the redrawable child and leaves the parent ready"
echo "B. A refresh() that finds unchanged data still fires 'ready' (without on_ready())"
echo "C. Repeated render/ready cycles do not accumulate 'ready' listeners"
echo "D. A child stopped while its parent waits for it releases the parent"
echo ""

exit $STATUS
