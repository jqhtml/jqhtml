#!/bin/bash
# cache_id_override - behavioral test for cache_id() custom cache-key override
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OUT=$(node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/cache_id_override_test.jqhtml" \
  "$SCRIPT_DIR/cache_id_override_test.js" \
  "$SCRIPT_DIR/cache_id_custom.jqhtml" \
  "$SCRIPT_DIR/cache_id_custom.js" \
  "$SCRIPT_DIR/cache_id_control.jqhtml" \
  "$SCRIPT_DIR/cache_id_control.js" \
  --delay=3 2>&1)
STATUS=$?
echo "$OUT"

[ $STATUS -ne 0 ] && exit $STATUS
echo "$OUT" | grep -q "ALL TESTS PASSED" || { echo "❌ Assertion failures detected"; exit 1; }
exit 0
