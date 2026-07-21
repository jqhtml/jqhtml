#!/bin/bash
# Test: Conditional Attributes
# Validates that conditional attributes compile correctly and render based on conditions

cd "$(dirname "$0")"
TEST_DIR=$(pwd)

echo "=================================================="
echo "Testing: Conditional Attributes"
echo "=================================================="
echo ""

# Run the test
node ../../jqhtml-tester-10-23/test-runner.js "$TEST_DIR/test.jqhtml"

echo ""
echo "=================================================="
echo "Expected Results:"
echo "=================================================="
echo "Test 1: Input should have 'required' attribute when args.required is true"
echo "Test 2: Input should have combination of required/disabled/readonly based on args"
echo "Test 3: Input should have min/max attributes with interpolated values"
echo "Test 4: Div should have class attribute with composite string when args.active is true"
echo "Test 5: All three inputs should render regardless of whitespace style"
echo "Test 6: Input should have regular attributes plus conditional ones"
echo "Test 7: Input should have attributes only when complex conditions are met"
echo "Test 8: Component should have conditional \$ attributes"
echo ""
echo "Key validation: Object.assign() should be used for conditional merging"
echo "Each conditional: (condition) ? {attr: value} : {}"
echo ""
