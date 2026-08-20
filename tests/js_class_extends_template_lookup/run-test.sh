#!/bin/bash
# Test runner for JS class template lookup

echo "=========================================="
echo "JQHTML Test: JS Class Template Lookup"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

# Run the test using the jqhtml-tester with all dependencies
# NOTE: form_base.jqhtml has template, my_form.js has NO template (just class)
node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/form_base.jqhtml" \
  "$SCRIPT_DIR/my_form.js" \
  "$SCRIPT_DIR/tester.jqhtml" \
  --delay=1

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "Component Structure:"
echo "  1. Form_Base.jqhtml + .js: Parent class WITH template"
echo "  2. My_Form.js: Child class extends Form_Base, NO template"
echo "  3. Tester: Instantiates My_Form"
echo ""
echo "Template Resolution:"
echo "  1. <My_Form /> is invoked"
echo "  2. My_Form class registered"
echo "  3. No My_Form template exists"
echo "  4. Framework walks JS prototype chain UP: My_Form → Form_Base → Jqhtml_Component"
echo "  5. Form_Base HAS a template"
echo "  6. Uses Form_Base template for My_Form instance"
echo ""
echo "Result:"
echo "  1. My_Form component renders using Form_Base template"
echo "  2. My_Form methods (format_output) available"
echo "  3. Form_Base methods (get_data, validate) available"
echo "  4. Template shows Form_Base markup"
echo "  5. No errors about missing template"
echo ""
echo "Validation:"
echo "  ✅ My_Form renders successfully"
echo "  ✅ Component is My_Form class"
echo "  ✅ Base class methods work (get_data, validate)"
echo "  ✅ Form_Base template used"
echo "  ✅ Template content correct"
echo ""
