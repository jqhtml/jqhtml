#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Whitespace Interpolation Bug"
echo "=========================================="
echo ""
echo "BUG DESCRIPTION:"
echo "When using interpolation followed by static text in an attribute:"
echo '  $title="<%= this.args.title %> (PLACEHOLDER)"'
echo ""
echo "The space before (PLACEHOLDER) is being trimmed/lost."
echo "Result: 'Dynamic Title(PLACEHOLDER)'"
echo "Expected: 'Dynamic Title (PLACEHOLDER)'"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/card_widget_header.jqhtml" \
  --delay=2

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "All titles should preserve whitespace:"
echo "1. 'Dynamic Title (PLACEHOLDER)' - space before ("
echo "2. 'Static Title (PLACEHOLDER)' - space before ("
echo "3. 'Prefix Dynamic Title' - space between words"
echo "4. 'Dynamic Title    (MULTIPLE SPACES)' - multiple spaces"
echo ""
