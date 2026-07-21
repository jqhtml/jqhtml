#!/bin/bash
# Test runner for lifecycle bottom-up timing

echo "=========================================="
echo "JQHTML Test: Lifecycle Bottom-Up Timing"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

# Run the test using the jqhtml-tester with all dependencies
node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/child.jqhtml" \
  "$SCRIPT_DIR/sibling.jqhtml" \
  "$SCRIPT_DIR/root.jqhtml" \
  --delay=5

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "Component Hierarchy:"
echo "  Root (1)"
echo "  ├── Sibling_A (1)"
echo "  │   ├── Child_A_child1 (2)"
echo "  │   └── Child_A_child2 (2)"
echo "  ├── Sibling_B (1)"
echo "  │   ├── Child_B_child1 (2)"
echo "  │   └── Child_B_child2 (2)"
echo "  └── Sibling_C (1)"
echo "      ├── Child_C_child1 (2)"
echo "      └── Child_C_child2 (2)"
echo ""
echo "Expected Execution Order:"
echo "  1. Level 2 (6 children): START nearly simultaneously"
echo "  2. Level 2 (6 children): END nearly simultaneously (~1s later)"
echo "  3. Level 1 (3 siblings): START nearly simultaneously"
echo "  4. Level 1 (3 siblings): END nearly simultaneously (~1s later)"
echo "  5. Level 0 (root): START after siblings complete"
echo "  6. Level 0 (root): END ~1s later"
echo ""
echo "Validation:"
echo "  ✅ All children complete BEFORE any sibling starts"
echo "  ✅ All siblings complete BEFORE root starts"
echo "  ✅ Siblings execute in parallel (start times within ~10ms)"
echo "  ✅ Children execute in parallel (start times within ~10ms)"
echo "  ✅ Total duration ≈ 3 seconds (3 levels × 1 second each)"
echo ""
