#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Detached Boot Optimization"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/static_component.jqhtml" \
  "$SCRIPT_DIR/loading_component.jqhtml" \
  "$SCRIPT_DIR/loading_component.js" \
  "$SCRIPT_DIR/slow_noop_component.jqhtml" \
  "$SCRIPT_DIR/slow_noop_component.js" \
  "$SCRIPT_DIR/static_defaults.jqhtml" \
  "$SCRIPT_DIR/static_defaults.js" \
  "$SCRIPT_DIR/loading_defaults.jqhtml" \
  "$SCRIPT_DIR/loading_defaults.js" \
  "$SCRIPT_DIR/slow_noop_defaults.jqhtml" \
  "$SCRIPT_DIR/slow_noop_defaults.js" \
  --delay=5

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1.  No initial render for detached components (sync check)"
echo "2-7.  Each component type renders exactly once (not twice)"
echo "8-13. Content correctness for all component types"
echo "14-16. Mid-load DOM append: loading component renders after append"
echo "17-19. Mid-load DOM append: slow noop renders after append"
echo ""
