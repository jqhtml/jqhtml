#!/bin/bash

echo "=========================================="
echo "JQHTML Test: on_loaded() Lifecycle Hook"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/after_load_test_component.jqhtml" \
  "$SCRIPT_DIR/after_load_test_component.js" \
  --delay=3

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. on_loaded() called once during initial boot"
echo "2. on_loaded() sees loaded data from on_load()"
echo "3. on_loaded() has DOM access (this.\$)"
echo "4. this.data is frozen (read-only) in on_loaded()"
echo "5. Primary use case: clone this.data to this.state"
echo "6. on_loaded() fires again on reload()"
echo "7. 'loaded' event triggered via this.trigger()"
echo ""
