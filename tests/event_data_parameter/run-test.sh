#!/bin/bash
# Test runner for event data parameter feature

echo "=========================================="
echo "JQHTML Test: Event Data Parameter"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

# Run the test using the jqhtml-tester with all dependencies
node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/emitter.jqhtml" \
  "$SCRIPT_DIR/receiver.jqhtml" \
  --delay=3

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "Test 1: Subscribe BEFORE trigger"
echo "  - Callback receives component and data object"
echo "  - data = { key: 'test-key', value: 42, nested: { foo: 'bar' } }"
echo ""
echo "Test 2: Subscribe AFTER trigger (late subscriber)"
echo "  - Callback should fire immediately (fire-if-already-occurred)"
echo "  - data should contain the original trigger data (NOT undefined)"
echo ""
echo "Test 3: Multiple triggers update stored data"
echo "  - Late subscribers receive the LATEST data from most recent trigger"
echo ""
echo "Validation:"
echo "  ✅ trigger(event, data) passes data to callbacks"
echo "  ✅ Late subscribers receive stored data"
echo "  ✅ Multiple triggers update stored data"
echo ""
