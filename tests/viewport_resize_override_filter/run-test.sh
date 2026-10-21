#!/bin/bash
# viewport_resize_override_filter - on_viewport_resize() is skipped when not overridden;
# call points, order, stop/detach handling and per-instance hooks unchanged.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OUT=$(node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/vrr_hooked.jqhtml" \
  "$SCRIPT_DIR/vrr_hooked.js" \
  "$SCRIPT_DIR/vrr_plain.jqhtml" \
  "$SCRIPT_DIR/vrr_plain.js" \
  "$SCRIPT_DIR/vrr_assigned.jqhtml" \
  "$SCRIPT_DIR/vrr_assigned.js" \
  "$SCRIPT_DIR/vrr_field.jqhtml" \
  "$SCRIPT_DIR/vrr_field.js" \
  "$SCRIPT_DIR/vrr_stopper.jqhtml" \
  "$SCRIPT_DIR/vrr_stopper.js" \
  "$SCRIPT_DIR/vrr_nest.jqhtml" \
  --delay=3 2>&1)
STATUS=$?
echo "$OUT"

[ $STATUS -ne 0 ] && exit $STATUS
echo "$OUT" | grep -q "ALL TESTS PASSED" || { echo "❌ Assertion failures detected"; exit 1; }
exit 0
