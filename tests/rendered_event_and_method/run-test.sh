#!/bin/bash
# rendered_event_and_method - behavioral test for component.rendered() / 'rendered' event
#
# Targets:
#   packages/core/src/component.ts ~1283-1288 (rendered(callback?))
#   packages/core/src/lifecycle-manager.ts ~146-171 ('rendered' trigger + _load_render_only bypass)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OUT=$(node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/rendered_event_test.jqhtml" \
  "$SCRIPT_DIR/rendered_event_test.js" \
  "$SCRIPT_DIR/rendered_order_child.jqhtml" \
  "$SCRIPT_DIR/rendered_order_child.js" \
  "$SCRIPT_DIR/rendered_flag_target.jqhtml" \
  --delay=3 2>&1)
STATUS=$?
echo "$OUT"

[ $STATUS -ne 0 ] && exit $STATUS
echo "$OUT" | grep -q "ALL TESTS PASSED" || { echo "❌ Assertion failures detected"; exit 1; }
exit 0
