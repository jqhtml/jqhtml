#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Stopped Component Waiters Settle"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/sw_slow.jqhtml" \
  "$SCRIPT_DIR/sw_slow.js" \
  "$SCRIPT_DIR/sw_throw_create.jqhtml" \
  "$SCRIPT_DIR/sw_throw_create.js" \
  "$SCRIPT_DIR/sw_plain.jqhtml" \
  "$SCRIPT_DIR/sw_plain.js" \
  --delay=5 --expect-boot-errors | tee "$OUTPUT_LOG"

STATUS=${PIPESTATUS[0]}

# The assertions are the gate: a missing summary means the run never got that far.
if ! grep -q "SUMMARY:" "$OUTPUT_LOG"; then STATUS=1; fi
if grep -q "FAIL:" "$OUTPUT_LOG"; then STATUS=1; fi
rm -f "$OUTPUT_LOG"

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "A. ready() on an already-stopped component resolves; its callback does not run"
echo "B. ready() pending when the component stops resolves; its callback does not run"
echo "C. rendered() on an already-stopped component resolves; its callback does not run"
echo "D. rendered() pending when the component stops resolves; its callback does not run"
echo "E. On a healthy component callbacks run once and no listeners are left behind"
echo "F. await jqhtml.boot() resolves and jqhtml:ready fires when on_create() throws"
echo ""

exit $STATUS
