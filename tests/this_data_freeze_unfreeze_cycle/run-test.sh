#!/bin/bash

echo "=========================================="
echo "JQHTML Test: this.data Freeze/Unfreeze Cycle"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/data_freeze_test.jqhtml" \
  "$SCRIPT_DIR/data_freeze_test.js" \
  --delay=2

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. ON_CREATE():"
echo "   this.data is WRITABLE"
echo "   Can set initial values"
echo ""
echo "2. AFTER ON_CREATE():"
echo "   this.data is FROZEN"
echo "   Attempting modifications throws error"
echo ""
echo "3. ON_LOAD():"
echo "   this.data is UNFROZEN"
echo "   Can load data from APIs"
echo ""
echo "4. AFTER ON_LOAD():"
echo "   this.data is FROZEN again"
echo "   Attempting modifications throws error"
echo ""
