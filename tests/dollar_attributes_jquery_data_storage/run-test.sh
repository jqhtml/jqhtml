#!/bin/bash

echo "=========================================="
echo "JQHTML Test: $ Attributes jQuery Data Storage"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/data_storage_component.jqhtml" \
  "$SCRIPT_DIR/data_storage_component.js" \
  --delay=2

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. JQUERY .DATA() ACCESS:"
echo "   this.\$.data('product_id') returns value"
echo "   this.args.product_id also works"
echo "   Both have same value"
echo ""
echo "2. NO DOM ATTRIBUTES:"
echo "   data-product-id does NOT appear in HTML"
echo "   data-category does NOT appear in HTML"
echo "   No $ attribute values leak to DOM"
echo ""
echo "3. IN-MEMORY STORAGE ONLY:"
echo "   Values stored in jQuery's internal cache"
echo "   Not visible in rendered markup"
echo ""
