#!/bin/bash
# Test runner for lifecycle method protection

echo "=========================================="
echo "JQHTML Test: Lifecycle Method Protection"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

# Run the test using the jqhtml-tester
node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/manual_on_create_call.jqhtml" \
  "$SCRIPT_DIR/manual_on_load_call.jqhtml" \
  "$SCRIPT_DIR/manual_on_ready_call.jqhtml" \
  "$SCRIPT_DIR/manual_on_render_call.jqhtml" \
  "$SCRIPT_DIR/manual_on_stop_call.jqhtml" \
  "$SCRIPT_DIR/lifecycle_executes_correctly.jqhtml" \
  "$SCRIPT_DIR/parent_calls_child_lifecycle.jqhtml" \
  "$SCRIPT_DIR/child_component.jqhtml" \
  --delay=3

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "Tests 1-5: Manual calls to lifecycle methods should throw errors"
echo "  - on_create(), on_load(), on_ready(), on_render(), on_stop()"
echo "  - Error message should include 'cannot be called manually'"
echo ""
echo "Test 6: Framework lifecycle calls should still work"
echo "  - All lifecycle methods should execute in order"
echo "  - Data from on_load() should be available"
echo ""
echo "Test 7: Parent cannot call child's lifecycle methods"
echo "  - Attempting to call child.on_load() should throw error"
echo ""
