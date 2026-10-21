#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Define \$ Arg Defaults Are Inherited"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/ia_base.jqhtml" \
  "$SCRIPT_DIR/ia_mid.jqhtml" \
  "$SCRIPT_DIR/ia_sized.jqhtml" \
  "$SCRIPT_DIR/ia_leaf.jqhtml" \
  "$SCRIPT_DIR/ia_data_mid.jqhtml" \
  "$SCRIPT_DIR/ia_data_leaf.jqhtml" \
  "$SCRIPT_DIR/ia_data_top.jqhtml" \
  "$SCRIPT_DIR/ia_arg_mid.jqhtml" \
  "$SCRIPT_DIR/ia_arg_leaf.jqhtml" \
  "$SCRIPT_DIR/ia_slot_base.jqhtml" \
  "$SCRIPT_DIR/ia_slot_base.js" \
  "$SCRIPT_DIR/ia_slot_child.jqhtml" \
  "$SCRIPT_DIR/ia_slot_child.js" \
  "$SCRIPT_DIR/ia_loaded.jqhtml" \
  "$SCRIPT_DIR/ia_loaded.js" \
  --delay=2
STATUS=$?

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "A. A parent <Define>'s \$size reaches an extends= child that does not set it"
echo "B. The child's own \$size beats the parent's"
echo "C. Three-level chain: each arg comes from the nearest <Define> that sets it"
echo "D. The same for a slot-only JS subclass (no extends=)"
echo "E. An invocation arg beats every <Define>"
echo "F. A data- attribute at the invocation beats every <Define>"
echo "G. \$foo and data-foo defaults are one arg: the nearer <Define> wins either way"
echo "H. on_load() and the cache key see the inherited arg"
echo ""

exit $STATUS
