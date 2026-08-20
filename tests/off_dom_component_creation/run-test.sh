#!/bin/bash
# Test runner for off-DOM component creation

echo "=========================================="
echo "JQHTML Test: Off-DOM Component Creation"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

# Run the test using the jqhtml-tester with all dependencies
node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/base_component.jqhtml" \
  "$SCRIPT_DIR/second_component.jqhtml" \
  "$SCRIPT_DIR/third_level_child.jqhtml" \
  "$SCRIPT_DIR/fourth_level_child.jqhtml" \
  --delay=1

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "Component Lifecycle:"
echo "  1. Base_Component renders in DOM"
echo "  2. Base_Component creates Second_Component off-DOM via \$('<div>').component()"
echo "  3. Second_Component boots off-DOM, renders Third_Level_Child"
echo "  4. Third_Level_Child boots, renders Fourth_Level_Child"
echo "  5. Fourth_Level_Child completes on_load (25ms async delay)"
echo "  6. Third_Level_Child on_ready fires (children ready)"
echo "  7. Second_Component on_ready fires, uses \$id() to modify Fourth_Level_Child text"
echo "  8. After 100ms, Second_Component attached to Base_Component in DOM"
echo ""
echo "Validation:"
echo "  ✅ \$id() works off-DOM using find() fallback"
echo "  ✅ id() returns component instances off-DOM"
echo "  ✅ Children complete on_ready before parent (bottom-up lifecycle)"
echo "  ✅ Fourth_Level_Child text = 'Modified by Second_Component'"
echo "  ✅ Text modification happened while off-DOM (before attachment)"
echo ""
