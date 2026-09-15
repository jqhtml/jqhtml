#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Attribute Quote Escaping"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/aqe_child.jqhtml" \
  --delay=2

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. A double quote inside an interpolated attribute value is encoded, so the value"
echo "   stays one attribute on plain tags, tracked tags, id-bearing tags and components"
echo "2. A hand-written id is emitted verbatim, even on a tracked element (@click)"
echo ""
