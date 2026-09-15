#!/bin/bash

echo "=========================================="
echo "JQHTML Test: this.data Deep Freeze"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/assert_helpers.js" \
  "$SCRIPT_DIR/deep_freeze_target.jqhtml" \
  "$SCRIPT_DIR/load_mutation_target.jqhtml" \
  --delay=2 | tee "$OUTPUT_LOG"

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
echo "A. Nested mutation of this.data throws in on_ready(), naming the dotted path"
echo "B. Reads (JSON.stringify, Array.isArray, for..of, map/filter, Object.keys,"
echo "   identity) behave exactly as they did before the deep freeze"
echo "C. on_load() may mutate nested data freely; the result is deep-frozen again"
echo "D. The object on_load() returned is never aliased into this.data"
echo "E. this.args hands out one stable read-only wrapper per object inside on_load()"
echo ""

exit $STATUS
