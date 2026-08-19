#!/bin/bash
# viewport_resize - on_viewport_resize() lifecycle hook and debounced window dispatch
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OUT=$(node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/vr_recorder.jqhtml" \
  "$SCRIPT_DIR/vr_recorder.js" \
  "$SCRIPT_DIR/vr_thrower.jqhtml" \
  "$SCRIPT_DIR/vr_thrower.js" \
  "$SCRIPT_DIR/vr_plain.jqhtml" \
  --delay=3 2>&1)
STATUS=$?
echo "$OUT"

[ $STATUS -ne 0 ] && exit $STATUS
echo "$OUT" | grep -q "ALL TESTS PASSED" || { echo "❌ Assertion failures detected"; exit 1; }
exit 0
