#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Simple Args Propagation"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/simple_component.jqhtml" \
  --delay=2

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. Component invoked with \$myval=\"hello\""
echo "2. on_load() receives this.args.myval = \"hello\""
echo "3. on_load() sets this.data.myval = \"hello\""
echo "4. Template renders: \"Value from args: hello\""
echo ""
