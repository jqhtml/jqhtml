#!/bin/bash

echo "=========================================="
echo "JQHTML Test: load() Method"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/load_test_component.jqhtml" \
  "$SCRIPT_DIR/load_test_component.js" \
  --delay=3

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. Initial on_load() populates data"
echo "2. load() updates this.data without re-rendering"
echo "3. load() returns true when data changed"
echo "4. DOM is unchanged after load() (no re-render)"
echo "5. this.data is frozen after load()"
echo "6. Multiple load() calls work correctly"
echo "7. render() after load() updates DOM with latest data"
echo ""
