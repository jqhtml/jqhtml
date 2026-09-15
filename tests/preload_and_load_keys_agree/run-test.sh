#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Preload and load() Key Agreement"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/pk_obj.jqhtml" \
  "$SCRIPT_DIR/pk_obj.js" \
  "$SCRIPT_DIR/pk_id.jqhtml" \
  "$SCRIPT_DIR/pk_id.js" \
  "$SCRIPT_DIR/pk_throw.jqhtml" \
  "$SCRIPT_DIR/pk_throw.js" \
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
echo "1. An object-arg component hydrates from an SSR preload entry (all modes)"
echo "2. A cache_id() component hydrates from a preload entry carrying its key (all modes)"
echo "3. load() writes the cache an equal-content sibling then reads in create() (data mode)"
echo "4. A cache_id() that throws inside load() marks data-nocache and warns once (all modes)"
echo ""

exit $STATUS
