#!/bin/bash

echo "=========================================="
echo "JQHTML Test: this.data Restore on reload()"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/data_restore_test.jqhtml" \
  "$SCRIPT_DIR/data_restore_test.js" \
  --delay=2

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. FIRST on_load():"
echo "   this.data starts with on_create() defaults"
echo "   counter = 0, increments to 1"
echo ""
echo "2. AFTER reload():"
echo "   this.data RESTORED to on_create() snapshot"
echo "   counter resets to 0, increments to 1 again"
echo "   Result: counter = 1 (not 2)"
echo ""
echo "3. INITIAL VALUES:"
echo "   Values set in on_create() persist"
echo ""
