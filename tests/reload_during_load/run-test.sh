#!/bin/bash
# Test runner for reload during load issue

echo "=========================================="
echo "JQHTML Test: reload() During on_load()"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

# Run the test using the jqhtml-tester with all dependencies
node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/parent_a.jqhtml" \
  "$SCRIPT_DIR/child_b.jqhtml" \
  --delay=3

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "Scenario: Parent A calls reload() on Child B while B is still in on_load()"
echo ""
echo "Timeline:"
echo "  0ms   - Child B starts on_load() (100ms delay)"
echo "  50ms  - Parent A's setTimeout fires, calls child.reload()"
echo "  100ms - Child B's first on_load() completes"
echo ""
echo "Expected: reload() during active on_load() should NOT throw error"
echo "          Instead, reload() should queue/debounce properly"
echo ""
