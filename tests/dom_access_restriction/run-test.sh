#!/bin/bash
# Test runner for DOM access restriction during on_load()

echo "=========================================="
echo "JQHTML Test: DOM Access Restriction"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

# Run the test using the jqhtml-tester
node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/valid_component.jqhtml" \
  "$SCRIPT_DIR/invalid_dollar.jqhtml" \
  "$SCRIPT_DIR/invalid_dollarid.jqhtml" \
  "$SCRIPT_DIR/invalid_id.jqhtml" \
  "$SCRIPT_DIR/invalid_setprop.jqhtml" \
  "$SCRIPT_DIR/valid_args.jqhtml" \
  "$SCRIPT_DIR/valid_methods.jqhtml" \
  --delay=3
HARNESS_STATUS=$?

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "✅ Test 1 (Valid Component):"
echo "   - Should successfully set this.data in on_load()"
echo "   - Status should show 'PASS'"
echo ""
echo "✅ Test 2 (Access this.$):"
echo "   - Should throw error when accessing this.$ in on_load()"
echo "   - Error message: 'Cannot access this.$ during on_load()'"
echo "   - Status should show 'PASS'"
echo ""
echo "✅ Test 3 (Access this.\$sid):"
echo "   - Should throw error when accessing this.\$sid() in on_load()"
echo "   - Error message: 'Cannot access this.\$sid during on_load()'"
echo "   - Status should show 'PASS'"
echo ""
echo "✅ Test 4 (Access this.sid):"
echo "   - Should throw error when accessing this.sid() in on_load()"
echo "   - Error message: 'Cannot access this.sid during on_load()'"
echo "   - Status should show 'PASS'"
echo ""
echo "✅ Test 5 (Set Property):"
echo "   - Should throw error when setting this.custom_prop in on_load()"
echo "   - Error message: 'Cannot modify this.custom_prop during on_load()'"
echo "   - Status should show 'PASS'"
echo ""
echo "✅ Test 6 (Access this.args):"
echo "   - Should successfully access this.args.user_id in on_load()"
echo "   - Value should be 42"
echo "   - Status should show 'PASS - user_id = 42'"
echo ""
echo "✅ Test 7 (Call Methods):"
echo "   - Should throw error when calling this.component_name() in on_load()"
echo "   - Error message: 'Cannot access this.component_name during on_load()'"
echo "   - Status should show 'PASS'"
echo ""

# Propagate the harness verdict (VERDICT: PASS/FAIL) as this script's exit code.
exit $HARNESS_STATUS
