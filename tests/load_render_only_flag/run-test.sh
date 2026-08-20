#!/bin/bash

echo "=========================================="
echo "JQHTML Test: _load_render_only Lifecycle Flag"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test.jqhtml"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$TEST_FILE" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/parent_component.jqhtml" \
  "$SCRIPT_DIR/parent_component.js" \
  "$SCRIPT_DIR/child_a.jqhtml" \
  "$SCRIPT_DIR/child_a.js" \
  "$SCRIPT_DIR/child_b.jqhtml" \
  "$SCRIPT_DIR/child_b.js" \
  --delay=4

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo " 1. Parent on_load() fires"
echo " 2. Parent on_render() does NOT fire"
echo " 3. Parent on_loaded() does NOT fire"
echo " 4. Parent on_ready() does NOT fire"
echo " 5. Child A on_load() fires (children created)"
echo " 6. Child B on_load() fires (children created)"
echo " 7. Child A on_render() does NOT fire (flag cascades)"
echo " 8. Child A on_loaded() does NOT fire (flag cascades)"
echo " 9. Child A on_ready() does NOT fire (flag cascades)"
echo "10. Child B on_render() does NOT fire"
echo "11. Child B on_loaded() does NOT fire"
echo "12. Child B on_ready() does NOT fire"
echo ""
