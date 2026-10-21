#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Markup Buffer - Arrays Print (Array)"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/mb_box.jqhtml" \
  "$SCRIPT_DIR/mb_fwd_b.jqhtml" \
  "$SCRIPT_DIR/mb_fwd_c.jqhtml" \
  --delay=3
HARNESS_STATUS=$?

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "1. An array prints the literal text (Array) in <%= %>, <%!= %> and <%br= %>"
echo "2. An array shaped like the old [instructions, context] pair prints (Array)"
echo "3. No array element reaches the page as markup"
echo "4. Default content still splices, with @click bound to the component that wrote it"
echo "5. A named slot with \$params still splices, bound to its definer"
echo "6. A slot forwarded through three levels still splices, bound to its definer"
echo "7. A component with no template still renders its default content"
echo ""

# Propagate the harness verdict (VERDICT: PASS/FAIL) as this script's exit code.
exit $HARNESS_STATUS
