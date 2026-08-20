#!/bin/bash

echo "=========================================="
echo "JQHTML Test: _load_only Lifecycle Flag"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/target_component.jqhtml" \
  "$SCRIPT_DIR/target_component.js" \
  "$SCRIPT_DIR/child_component.jqhtml" \
  --delay=3

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. on_load() fires (data fetching works)"
echo "2. on_render() does NOT fire (no DOM hooks)"
echo "3. on_loaded() does NOT fire (suppressed)"
echo "4. on_ready() does NOT fire (suppressed)"
echo "5. No child components created (render skipped)"
echo "6. ready event fires (lifecycle completes)"
echo "7. this.data populated from on_load()"
echo ""
