#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Data Cache Mode 2"
echo "=========================================="
echo ""
echo "This test verifies Mode 2 data caching with ES6 class restoration:"
echo "1. Component loads data with ES6 class instance via on_load()"
echo "2. Component is removed from DOM"
echo "3. Component is recreated with same args"
echo "4. Cached data should hydrate this.data immediately"
echo "5. ES6 class instance should be properly restored (not plain object)"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/cached_component.jqhtml" \
  "$SCRIPT_DIR/contact_model.js" \
  --delay=3

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. First instance loads and creates Contact_Model instance"
echo "2. First instance is removed"
echo "3. Second instance IMMEDIATELY has Contact_Model restored from cache"
echo "4. Contact should be instanceof Contact_Model, not plain object"
echo "5. Contact should have get_display_name() method available"
echo ""
