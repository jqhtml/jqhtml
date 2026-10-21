#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Define Defaults: Nearest Template Wins"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/dn_grand.jqhtml" \
  "$SCRIPT_DIR/dn_parent.jqhtml" \
  "$SCRIPT_DIR/dn_child.jqhtml" \
  "$SCRIPT_DIR/dn_slot_base.jqhtml" \
  "$SCRIPT_DIR/dn_slot_base.js" \
  "$SCRIPT_DIR/dn_slot_child.jqhtml" \
  "$SCRIPT_DIR/dn_slot_child.js" \
  --delay=2
STATUS=$?

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "A. A child <Define>'s own default beats its parent's: plain attribute, data-/\$"
echo "   arg (this.args and the element) and each style property"
echo "B. In a three-level chain the nearest <Define> wins"
echo "C. Class still merges, farthest <Define> first, in the same order as before"
echo "D. The invocation beats every <Define>, including tabindex=\"0\""
echo "E. The same precedence holds for a slot-only JS subclass (no extends=)"
echo "F. \$foo and data-foo are one arg: across templates the nearer spelling wins"
echo ""

exit $STATUS
