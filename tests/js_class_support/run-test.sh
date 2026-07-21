#!/bin/bash
# Test runner for JS class support

echo "=========================================="
echo "JQHTML Test: JS Class Support"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

# Run the test using the jqhtml-tester
node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" "$TEST_FILE"

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "Console output should show:"
echo "  ✅ Hello World from JS class on_ready()!"
echo "  Component name: Hello_Test"
echo "  Component CID: c1 (or similar)"
echo ""
echo "This proves that paired .js files are loaded and"
echo "component lifecycle methods execute correctly."
echo ""
