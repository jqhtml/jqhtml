#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Deduplicated Follower Holds Live Class Instances"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/cfc_models.js" \
  "$SCRIPT_DIR/cfc_item.jqhtml" \
  "$SCRIPT_DIR/cfc_item.js" \
  --delay=5 | tee "$OUTPUT_LOG"

STATUS=${PIPESTATUS[0]}

if ! grep -q "SUMMARY:" "$OUTPUT_LOG"; then STATUS=1; fi
if grep -q "FAIL:" "$OUTPUT_LOG"; then STATUS=1; fi
rm -f "$OUTPUT_LOG"

echo ""
echo "=========================================="
echo "Expected Behavior (all three cache modes):"
echo "=========================================="
echo ""
echo "A. Three identical instances run on_load() once (two are followers)"
echo "B. Leader and followers hold the same live instances: toJSON() classes,"
echo "   private-field classes, plainly registered classes, Date, Map, Set"
echo "C. Every instance renders by calling methods on those instances"
echo "D. Follower data deep-equals leader data and shares no object"
echo "E. (data mode) a cold render rebuilds the instances from localStorage and"
echo "   the following server load compares equal - no redraw"
echo ""

exit $STATUS
