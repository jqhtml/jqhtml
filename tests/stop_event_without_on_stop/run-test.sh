#!/bin/bash
# stop_event_without_on_stop - regression test for _stop() fast path checking
# the dead 'destroy' event name instead of 'stop'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OUT=$(node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/stop_event_child.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  --delay=2 2>&1)
STATUS=$?
echo "$OUT"

[ $STATUS -ne 0 ] && exit $STATUS
echo "$OUT" | grep -q "ALL TESTS PASSED" || { echo "❌ Assertion failures detected"; exit 1; }
exit 0
