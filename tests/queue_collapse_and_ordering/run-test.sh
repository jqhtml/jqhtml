#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Lifecycle Queue Collapse and Ordering"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_LOG="$(mktemp)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/queue_probe.jqhtml" \
  "$SCRIPT_DIR/queue_probe.js" \
  --delay=4 | tee "$OUTPUT_LOG"

STATUS=${PIPESTATUS[0]}

# The harness sets window.testReady itself, so it cannot fail this test on its own.
# The assertions are the gate: a missing summary means the run never got that far.
if ! grep -q "SUMMARY:" "$OUTPUT_LOG"; then STATUS=1; fi
if grep -q "FAIL:" "$OUTPUT_LOG"; then STATUS=1; fi
rm -f "$OUTPUT_LOG"

echo ""
echo "=========================================="
echo "Expected Behavior (all three cache modes):"
echo "=========================================="
echo ""
echo "1. Three synchronous load() calls run on_load twice and ALL THREE resolve true"
echo "2. load() + render() collapse correctly, even queued behind a running reload()"
echo "3. A caller's promise resolves BEFORE the next queued operation starts"
echo "4. A throwing executor rejects only its own callers; the queue continues"
echo "5. refresh() queued behind reload() still renders (reload precedence)"
echo ""

exit $STATUS
