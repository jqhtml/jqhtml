#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Interpolated id Attribute"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  --delay=2
HARNESS_STATUS=$?

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. id=\"x_<%= expr %>\" renders as id=\"x_<value>\" (parts concatenated, expression parenthesised)"
echo "2. A hand-written id is never cid-scoped, interpolated or not, tracked or not"
echo ""

# Propagate the harness verdict (VERDICT: PASS/FAIL) as this script's exit code.
exit $HARNESS_STATUS
