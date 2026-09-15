#!/bin/bash

echo "=========================================="
echo "JQHTML Test: create Event Fires Once"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/ce_probe.jqhtml" \
  "$SCRIPT_DIR/ce_probe.js" \
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
echo "A. on('create')/once('create') registered inside on_create() each fire exactly once"
echo "   (and the same subscribers attached right after .component() see one replay)"
echo "B. A listener registered after ready() replays 'create' exactly once"
echo "C. The late replay does not re-fire the boot-time subscribers"
echo ""

exit $STATUS
