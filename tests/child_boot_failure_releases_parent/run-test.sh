#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Child Boot Failure Releases Parent"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/bf_parent.jqhtml" \
  "$SCRIPT_DIR/bf_parent.js" \
  "$SCRIPT_DIR/bf_good.jqhtml" \
  "$SCRIPT_DIR/bf_good.js" \
  "$SCRIPT_DIR/bf_bad.jqhtml" \
  "$SCRIPT_DIR/bf_bad.js" \
  "$SCRIPT_DIR/bf_slow.jqhtml" \
  "$SCRIPT_DIR/bf_slow.js" \
  "$SCRIPT_DIR/bf_plain.jqhtml" \
  "$SCRIPT_DIR/bf_plain.js" \
  "$SCRIPT_DIR/bf_plain_parent.jqhtml" \
  "$SCRIPT_DIR/bf_plain_parent.js" \
  --delay=5 --expect-boot-errors | tee "$OUTPUT_LOG"

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
echo "A. A child whose on_load() throws is stopped and releases its parent"
echo "B. A failing boot is reported, not raised as an unhandled rejection"
echo "C. A component stopped mid-reload runs no on_loaded()/on_ready() afterwards"
echo "D. A plain child (no on_stop, no listeners) is fully stopped on re-render"
echo "E. The 'create' event count is recorded for a later step"
echo ""

exit $STATUS
