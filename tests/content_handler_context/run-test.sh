#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Handler Context in Caller-Written Content"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/ctx_box.jqhtml" \
  "$SCRIPT_DIR/ctx_box.js" \
  "$SCRIPT_DIR/ctx_marker.jqhtml" \
  --delay=3

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. @click in a <Slot:> body runs with this = the component whose template wrote it"
echo "2. \$sid in a slot body scopes to that same component (unchanged)"
echo "3. A hand-written id= in a slot body scopes to that component's cid"
echo "4. A component written in a slot body reports it from instantiator()"
echo "5. Default content between component tags behaves the same"
echo "6. content('row', record, index) still delivers the child's data; \$params names it"
echo "7. Markup in the receiving component's own template is unaffected"
echo ""
