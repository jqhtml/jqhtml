#!/bin/bash
# Test: Interpolated Attribute Expressions
# Validates that expressions in attributes preserve correct operator precedence

cd "$(dirname "$0")"
TEST_DIR=$(pwd)

echo "=================================================="
echo "Testing: Interpolated Attribute Expressions"
echo "=================================================="
echo ""

# Run the test
node ../../jqhtml-tester-10-23/test-runner.js "$TEST_DIR/test.jqhtml"

echo ""
echo "=================================================="
echo "Expected Results:"
echo "=================================================="
echo "Test 1: class='my-class'"
echo "Test 2: class='active'"
echo "Test 3: class='static active'"
echo "Test 4: class='item-1', 'item-2', 'item-3'"
echo "Test 5: Second <li> should have class='page-item active'"
echo "Test 6: class='visible'"
echo "Test 7: class='hidden'"
echo "Test 8: class='not-first'"
echo ""
