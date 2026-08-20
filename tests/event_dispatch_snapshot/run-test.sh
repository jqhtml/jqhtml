#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Event Dispatch Snapshot"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/test_dispatch_child.jqhtml" \
  "$SCRIPT_DIR/test_dispatch_child.js" \
  --delay=6

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1.  Two pending .once() on the same event both fire"
echo "2.  .once() + .once() + .on() all fire in registration order"
echo "3.  .once() registered before .on() does not skip the .on()"
echo "4.  Five consecutive .once() handlers all fire and all deregister"
echo "5.  .once() still fires exactly once across repeated triggers"
echo "6.  A handler registered during dispatch is not in that dispatch's snapshot"
echo "7.  Two independent 'await once(ready)' promises both resolve"
echo ""
