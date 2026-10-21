#!/bin/bash
# Test runner for $redrawable and $sid scoping behavior

echo "=========================================="
echo "JQHTML Test: \$redrawable and \$sid Scoping"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

# Run the test using the jqhtml-tester
node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" "$TEST_FILE"
HARNESS_STATUS=$?

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. Regular id attributes pass through unchanged:"
echo "   <section id=\"regular_section_id\"> → id=\"regular_section_id\""
echo ""
echo "2. \$sid attributes get scoped to parent component's _cid:"
echo "   <p \$sid=\"test_p\"> → id=\"test_p:PARENT_CID\" data-sid=\"test_p\""
echo ""
echo "3. Both HTML tags and components exhibit same behavior"
echo ""
echo "4. When both id and \$sid present, \$sid takes precedence"
echo ""
echo "5. All scoped IDs use the PARENT component's _cid, not their own"
echo ""

# Propagate the harness verdict (VERDICT: PASS/FAIL) as this script's exit code.
exit $HARNESS_STATUS
