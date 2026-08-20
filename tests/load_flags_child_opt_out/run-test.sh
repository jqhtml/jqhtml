#!/bin/bash
# load_flags_child_opt_out - _load_only cascades to children unless a child
# explicitly opts out (instruction-processor.ts ~254-255)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OUT=$(node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/parent_component.jqhtml" \
  "$SCRIPT_DIR/parent_component.js" \
  "$SCRIPT_DIR/child_a_component.jqhtml" \
  "$SCRIPT_DIR/child_a_component.js" \
  "$SCRIPT_DIR/child_b_component.jqhtml" \
  "$SCRIPT_DIR/child_b_component.js" \
  --delay=3 2>&1)
STATUS=$?
echo "$OUT"

[ $STATUS -ne 0 ] && exit $STATUS
echo "$OUT" | grep -q "ALL TESTS PASSED" || { echo "❌ Assertion failures detected"; exit 1; }
exit 0
