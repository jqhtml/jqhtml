#!/bin/bash

echo "=========================================="
echo "JQHTML Test: gate_load() Lifecycle"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/gated_component.jqhtml" \
  "$SCRIPT_DIR/gated_component.js" \
  "$SCRIPT_DIR/no_load_gated_component.jqhtml" \
  "$SCRIPT_DIR/no_load_gated_component.js" \
  --delay=5

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "A.  Gate delays the first on_load until it resolves"
echo "G.  First paint is NOT delayed by a pending gate (renders synchronously)"
echo "B.  Multiple gates are all awaited together"
echo "C.  A rejected gate is logged and the load still proceeds"
echo "D.  reload() after first load does not re-await gates"
echo "E.  gate_load() after first load throws"
echo "F.  Component without custom on_load() is unaffected by gates"
echo "H.  stop() during gate wait abandons the load cleanly"
echo "I.  reload() while gated resumes the lifecycle (late gate settle is a no-op)"
echo "J.  refresh() while gated resumes the lifecycle"
echo ""
