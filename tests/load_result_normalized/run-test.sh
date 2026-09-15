#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Every on_load() Result Is Normalized"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/lrn_models.js" \
  "$SCRIPT_DIR/lrn_sink.jqhtml" \
  "$SCRIPT_DIR/lrn_sink.js" \
  "$SCRIPT_DIR/lrn_prod.jqhtml" \
  "$SCRIPT_DIR/lrn_prod.js" \
  --delay=5 | tee "$OUTPUT_LOG"

STATUS=${PIPESTATUS[0]}

# The harness sets window.testReady itself, so it cannot fail this test on its own.
# The assertions are the gate: a missing summary means the run never got that far.
if ! grep -q "SUMMARY:" "$OUTPUT_LOG"; then STATUS=1; fi
if grep -q "FAIL:" "$OUTPUT_LOG"; then STATUS=1; fi
rm -f "$OUTPUT_LOG"

echo ""
echo "=========================================="
echo "Expected Behavior (all three cache modes):"
echo "=========================================="
echo ""
echo "A. Date, Map, Set and register_cache_class() instances survive the round trip"
echo "B. An unregistered class instance degrades to a plain object"
echo "C. Functions, jQuery objects, DOM nodes, promises and cycles are stripped"
echo "D. this.data is jqhtml's own copy - no aliasing of the author's objects"
echo "E. One warning per (component, path), across reloads and instances"
echo "F. Production mode converts silently"
echo ""

exit $STATUS
