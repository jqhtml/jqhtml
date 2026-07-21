#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Define Tag $ Defaults"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/component_with_defaults.jqhtml" \
  "$SCRIPT_DIR/component_with_defaults.js" \
  "$SCRIPT_DIR/test_container.jqhtml" \
  "$SCRIPT_DIR/test_container.js" \
  --delay=2

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. DEFAULT VALUES:"
echo "   Component defined with \$per_page=25, \$sortable=true, etc."
echo "   Invocation without args uses defaults"
echo ""
echo "2. FULL OVERRIDE:"
echo "   Invocation can override all default values"
echo "   Types preserved (quoted vs unquoted)"
echo ""
echo "3. PARTIAL OVERRIDE:"
echo "   Invocation can override some args"
echo "   Non-overridden args use Define defaults"
echo ""
