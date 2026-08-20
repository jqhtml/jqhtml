#!/bin/bash
# Test runner for template extends JS class inheritance

echo "=========================================="
echo "JQHTML Test: Template Extends JS Class Inheritance"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

# Run the test using the jqhtml-tester with all dependencies
# NOTE: contacts_datagrid.js does NOT exist - only template
node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/datagrid_abstract.jqhtml" \
  "$SCRIPT_DIR/contacts_datagrid.jqhtml" \
  "$SCRIPT_DIR/tester.jqhtml" \
  --delay=1

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "Component Structure:"
echo "  1. DataGrid_Abstract: Base template + JS class with data loading logic"
echo "  2. Contacts_DataGrid: Child template with extends='DataGrid_Abstract'"
echo "  3. Contacts_DataGrid has NO .js file"
echo ""
echo "Class Resolution:"
echo "  1. <Contacts_DataGrid /> is invoked"
echo "  2. No Contacts_DataGrid.js class registered"
echo "  3. Framework checks Contacts_DataGrid template"
echo "  4. Template has extends='DataGrid_Abstract'"
echo "  5. Framework walks extends chain"
echo "  6. Finds DataGrid_Abstract has registered JS class"
echo "  7. Uses DataGrid_Abstract class for Contacts_DataGrid instance"
echo ""
echo "Lifecycle:"
echo "  1. DataGrid_Abstract on_create() fires → initializes data.rows = []"
echo "  2. Contacts_DataGrid template renders (child slots merged into parent)"
echo "  3. DataGrid_Abstract on_load() fires → simulates data fetch, populates rows"
echo "  4. Template re-renders with loaded data"
echo "  5. DataGrid_Abstract on_ready() fires → component fully initialized"
echo ""
echo "Validation:"
echo "  ✅ Contacts_DataGrid uses DataGrid_Abstract JS class"
echo "  ✅ on_create() executed (data structure initialized)"
echo "  ✅ on_load() executed (data loaded)"
echo "  ✅ on_ready() executed (component ready)"
echo "  ✅ Template renders with parent structure + child slots"
echo "  ✅ Parent class methods available on child instance"
echo ""
