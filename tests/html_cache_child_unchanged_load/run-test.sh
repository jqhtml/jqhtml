#!/bin/bash

echo "=========================================="
echo "JQHTML Test: HTML Cache - Child Whose on_load() Leaves Data Unchanged"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/hcu_child.jqhtml" \
  "$SCRIPT_DIR/hcu_parent.jqhtml" \
  "$SCRIPT_DIR/hcu_seed_leaf.jqhtml" \
  --delay=5 | tee "$OUTPUT_LOG"

STATUS=${PIPESTATUS[0]}

# The assertions are the gate: a missing summary means the run never got that far.
if ! grep -q "SUMMARY:" "$OUTPUT_LOG"; then STATUS=1; fi
if grep -q "FAIL:" "$OUTPUT_LOG"; then STATUS=1; fi
rm -f "$OUTPUT_LOG"

echo ""
echo "=========================================="
echo "Expected Behavior ('html' mode; the other two modes instant-pass):"
echo "=========================================="
echo ""
echo "A. First boot: a dynamic parent whose child's on_load() leaves its data equal to"
echo "   the on_create() defaults reaches ready() within 1s and writes a snapshot that"
echo "   holds the child's final DOM"
echo "B. Cache-hit boot: the same holds after the snapshot is injected, the parent"
echo "   re-renders and a fresh child loads unchanged data"
echo ""

exit $STATUS
