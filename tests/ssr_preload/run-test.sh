#!/bin/bash

echo "=========================================="
echo "JQHTML Test: SSR Preload API"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-tester-10-23/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/preload_child.jqhtml" \
  "$SCRIPT_DIR/preload_child.js" \
  "$SCRIPT_DIR/static_child.jqhtml" \
  "$SCRIPT_DIR/static_child.js" \
  --delay=8

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. Data capture records on_load component data"
echo "2. Capture deduplicates same component+args"
echo "3. Preloaded data skips on_load (fast boot)"
echo "4. Preload entries consumed on first use (one-shot)"
echo "5. clear_preload_data removes unconsumed entries"
echo "6. Preload uses args-based key matching"
echo "7. null/empty set_preload_data is no-op"
echo "8. Full round-trip: capture → preload"
echo "9. Static components excluded from capture"
echo ""
