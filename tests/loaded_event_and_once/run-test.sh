#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Loaded Event and .once()"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/test_child.jqhtml" \
  "$SCRIPT_DIR/test_child.js" \
  --delay=5

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1.  .on('loaded') fires (sticky) on already-loaded component"
echo "2.  .once('loaded') fires immediately when event already occurred"
echo "3.  .once() does not register callback after immediate fire"
echo "4.  .once('ready') works for other sticky events too"
echo "5.  .once() for custom future events fires exactly once"
echo "6.  .on('loaded') fires again on reload()"
echo "7.  .once() on new component before event occurs"
echo "8.  .once() returns component for chaining"
echo ""
