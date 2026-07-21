#!/bin/bash
# Test runner for JS class template inheritance

echo "=========================================="
echo "JQHTML Test: JS Class Template Inheritance"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

# Run the test using the jqhtml-tester with all dependencies
# NOTE: phone_text_input.jqhtml does NOT exist - only .js file
node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/text_input.jqhtml" \
  "$SCRIPT_DIR/tester.jqhtml" \
  --delay=1

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "Component Structure:"
echo "  1. Text_Input: Base component with .jqhtml template + .js class"
echo "  2. Phone_Text_Input: Child component with ONLY .js class (no .jqhtml)"
echo "  3. Tester: Uses Phone_Text_Input instance"
echo ""
echo "Template Resolution:"
echo "  1. Phone_Text_Input has no explicit template defined"
echo "  2. Framework walks JS prototype chain (Phone_Text_Input → Text_Input)"
echo "  3. Finds Text_Input template and uses it for Phone_Text_Input"
echo ""
echo "Method Inheritance:"
echo "  1. Phone_Text_Input inherits get_value() and set_value() from Text_Input"
echo "  2. Phone_Text_Input adds get_formatted_phone() and set_phone() methods"
echo "  3. All methods work on inherited template elements"
echo ""
echo "Validation:"
echo "  ✅ Phone_Text_Input renders using Text_Input template"
echo "  ✅ Inherited methods (get_value/set_value) work"
echo "  ✅ Child methods (get_formatted_phone) work"
echo "  ✅ Phone formatting: '5551234567' → '(555) 123-4567'"
echo "  ✅ Auto-formatting: set_phone('8005551212') → '(800) 555-1212'"
echo ""
