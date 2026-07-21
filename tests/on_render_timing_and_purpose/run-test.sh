#!/bin/bash

echo "=========================================="
echo "JQHTML Test: on_render() Timing and Purpose"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/parent_with_render.jqhtml" \
  "$SCRIPT_DIR/parent_with_render.js" \
  "$SCRIPT_DIR/child_component.jqhtml" \
  "$SCRIPT_DIR/child_component.js" \
  --delay=2

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. Parent on_render() fires FIRST"
echo "   - Immediately after DOM creation"
echo "   - BEFORE child components boot"
echo "   - Hides uninitialized UI (opacity: 0)"
echo ""
echo "2. Child boots and on_ready() fires"
echo "   - After parent on_render()"
echo ""
echo "3. Parent on_ready() fires LAST"
echo "   - After all children ready"
echo "   - Shows UI (opacity: 1)"
echo ""
