#!/bin/bash
# Test: Whitespace Preservation
# Validates that whitespace between elements is properly preserved or collapsed

cd "$(dirname "$0")"
TEST_DIR=$(pwd)

echo "=================================================="
echo "Testing: Whitespace Preservation"
echo "=================================================="
echo ""

# Run the test
node ../../jqhtml-render-harness/test-runner.js "$TEST_DIR/test.jqhtml"

echo ""
echo "=================================================="
echo "Expected Results:"
echo "=================================================="
echo "Rule 1: Single space preserved between elements"
echo "Rule 2: Multiple whitespace collapsed to single space"
echo "Rule 3: Minified markup (no spaces) respected"
echo "Rule 4: Leading/trailing spaces in text preserved"
echo ""
