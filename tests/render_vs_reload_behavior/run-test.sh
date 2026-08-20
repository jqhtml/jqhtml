#!/bin/bash

echo "=========================================="
echo "JQHTML Test: render() vs reload()"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/render_reload_test.jqhtml" \
  "$SCRIPT_DIR/render_reload_test.js" \
  --delay=2

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. render():"
echo "   - Re-renders with current this.data"
echo "   - Does NOT call on_load()"
echo "   - Calls on_ready()"
echo ""
echo "2. reload():"
echo "   - Re-fetches data via on_load()"
echo "   - DOES call on_load()"
echo "   - Calls on_ready()"
echo ""
