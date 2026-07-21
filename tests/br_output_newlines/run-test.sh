#!/bin/bash

echo "=========================================="
echo "JQHTML Test: BR Output (<%br= %> syntax)"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/br_output_component.jqhtml" \
  "$SCRIPT_DIR/br_output_component.js" \
  --delay=2

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. STANDARD ESCAPED (<%= %>):"
echo "   - Newlines remain as literal characters"
echo "   - NO <br /> tags in output"
echo ""
echo "2. BR OUTPUT (<%br= %>):"
echo "   - Text is HTML-escaped (safe)"
echo "   - Newlines (\n) converted to <br /> tags"
echo "   - Visual line breaks in output"
echo ""
echo "3. BR OUTPUT WITH HTML CHARS:"
echo "   - HTML tags escaped (&lt;strong&gt;)"
echo "   - Script tags escaped (XSS protection)"
echo "   - STILL has <br /> for newlines"
echo ""
echo "4. UNESCAPED (<%!= %>):"
echo "   - Raw output, no escaping"
echo "   - NO <br /> conversion (not the purpose)"
echo ""
