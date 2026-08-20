#!/bin/bash
# render_returns_promise - regression test for render() discarding its queue promise
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OUT=$(node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/render_promise_test.jqhtml" \
  "$SCRIPT_DIR/render_promise_test.js" \
  --delay=2 2>&1)
STATUS=$?
echo "$OUT"

[ $STATUS -ne 0 ] && exit $STATUS
echo "$OUT" | grep -q "ALL TESTS PASSED" || { echo "❌ Assertion failures detected"; exit 1; }
exit 0
