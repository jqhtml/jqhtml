#!/bin/bash

echo "=========================================="
echo "JQHTML Test: HTML Cache Mode 1"
echo "=========================================="
echo ""
echo "This test verifies Mode 1 HTML caching:"
echo "1. Component loads data via on_load()"
echo "2. Component is removed from DOM"
echo "3. Component is recreated with same args"
echo "4. Cached HTML should display immediately"
echo "5. Fresh data loads and replaces cached HTML"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/cached_component.jqhtml" \
  --delay=3

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. First instance loads and displays 'Loaded Title'"
echo "2. First instance is removed"
echo "3. Second instance IMMEDIATELY shows 'Loaded Title' (from cache)"
echo "4. Second instance loads fresh data and updates"
echo ""
