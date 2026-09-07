#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Component Debug Overlay"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/dbg_outer.jqhtml" \
  "$SCRIPT_DIR/dbg_inner.jqhtml" \
  "$SCRIPT_DIR/dbg_marker.jqhtml" \
  --delay=3

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. enable() installs the light stylesheet, the shadow host and the <html data-jqhtml-debug> gate"
echo "2. Hovering outlines the component under the pointer and every ancestor, each with a label"
echo "3. Clicking opens the inspector modal and the component's own handler does not run"
echo "4. Escape closes the modal; Alt+click passes through; clicks inside the modal are not hijacked"
echo "5. Components created after enable() are covered with no extra setup"
echo "6. disable() removes listeners, classes, the gate and the host; styles stay installed and inert"
echo "7. enable() again reuses the installation"
echo ""
