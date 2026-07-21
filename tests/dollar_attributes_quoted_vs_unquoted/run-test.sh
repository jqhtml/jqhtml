#!/bin/bash

echo "=========================================="
echo "JQHTML Test: $ Attributes Quoted vs Unquoted"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/parent_component.jqhtml" \
  "$SCRIPT_DIR/parent_component.js" \
  "$SCRIPT_DIR/child_component.jqhtml" \
  "$SCRIPT_DIR/child_component.js" \
  --delay=2

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. QUOTED ATTRIBUTES (Strings):"
echo "   \$id=\"123\" → typeof string, value \"123\""
echo "   \$flag=\"true\" → typeof string, value \"true\""
echo ""
echo "2. UNQUOTED ATTRIBUTES (Expressions):"
echo "   \$id=123 → typeof number, value 123"
echo "   \$enabled=true → typeof boolean, value true"
echo "   \$obj=this.data.obj → typeof object, actual reference"
echo "   \$fn=this.callback → typeof function, callable"
echo ""
echo "3. CRITICAL DISTINCTION:"
echo "   Quotes determine parsing: string literal vs JS expression"
echo ""
