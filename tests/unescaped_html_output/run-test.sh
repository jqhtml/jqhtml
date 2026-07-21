#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Unescaped HTML Output"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/html_output_component.jqhtml" \
  "$SCRIPT_DIR/html_output_component.js" \
  --delay=2

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. ESCAPED OUTPUT (<%= %>):"
echo "   - Should display literal text: <strong>Bold Text</strong>"
echo "   - Should NOT render as bold HTML"
echo "   - HTML entities should be escaped (&lt;strong&gt;)"
echo ""
echo "2. UNESCAPED OUTPUT (<%!= %>):"
echo "   - Should render as actual HTML with bold formatting"
echo "   - Should contain a real <strong> element in DOM"
echo ""
echo "3. XSS PROTECTION:"
echo "   - Script tag should be escaped"
echo "   - Should NOT execute alert()"
echo "   - Should display as literal text"
echo ""
