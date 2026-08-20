#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Void Element Auto-Closing"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/void_elements_component.jqhtml" \
  "$SCRIPT_DIR/void_elements_component.js" \
  --delay=2

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. HTML5 VOID ELEMENTS:"
echo "   - input, img, br, hr, meta, link, area, col, embed, source, track, wbr"
echo "   - Should render without explicit closing tags"
echo "   - No parser errors"
echo ""
echo "2. ELEMENT ACCESSIBILITY:"
echo "   - All void elements should be accessible via \$id()"
echo "   - Should have correct tag names in DOM"
echo ""
echo "3. COMPILATION:"
echo "   - Template should compile without errors"
echo "   - No warnings about unclosed tags"
echo ""
