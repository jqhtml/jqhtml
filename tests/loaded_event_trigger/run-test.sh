#!/bin/bash
# Test runner for 'loaded' event trigger

echo "=========================================="
echo "JQHTML Test: Loaded Event Trigger"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

# Run the test using the jqhtml-tester with all dependencies
node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/with_on_load.jqhtml" \
  "$SCRIPT_DIR/without_on_load.jqhtml" \
  --delay=3

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "The 'loaded' event should fire after on_load completes"
echo "(or at the point where on_load would have run for static components)"
echo ""
echo "Validation:"
echo "  ✅ 'loaded' event fires for component WITH on_load"
echo "  ✅ 'loaded' event fires for component WITHOUT on_load"
echo "  ✅ Event fires AFTER on_load() completes (not before)"
echo ""
