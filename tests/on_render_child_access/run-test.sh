#!/bin/bash
# Test runner for on_render child access timing

echo "=========================================="
echo "JQHTML Test: on_render Child Access"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

# Run the test using the jqhtml-tester with all dependencies
node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/component_a.jqhtml" \
  "$SCRIPT_DIR/component_b.jqhtml" \
  "$SCRIPT_DIR/component_c.jqhtml" \
  "$SCRIPT_DIR/component_d.jqhtml" \
  --delay=3

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "Lifecycle order should be:"
echo "  1. [A] on_create (sets loading = true)"
echo "  2. [A] first render (shows 'Loading...')"
echo "  3. [A] on_render (for loading state)"
echo "  4. [A] on_load (waits 100ms, sets loading = false)"
echo "  5. [A] second render (creates B, C, D hierarchy)"
echo "     -> [B] on_create, render, on_render"
echo "        -> [C] on_create, render, on_render"
echo "           -> [D] on_create, render, on_render"
echo "  6. [A] on_render - should be able to access D here!"
echo ""
echo "The key assertion:"
echo "  In Component A's on_render (after loading=false render),"
echo "  this.sid('component_d') should find Component D"
echo "  and component_d.hello() should return 'Hello from Component D!'"
echo ""
