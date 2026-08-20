#!/bin/bash
# undefined_component_tag_override - an UNREGISTERED component (no
# register_component/register_template call anywhere) invoked with
# tag="nav" must render as <nav class="Never_Defined_Component Component">,
# and without tag= must render as <div> (DEFAULT_TEMPLATE.tag).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OUT=$(node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  --delay=1 2>&1)
STATUS=$?
echo "$OUT"

[ $STATUS -ne 0 ] && exit $STATUS
echo "$OUT" | grep -q "ALL TESTS PASSED" || { echo "❌ Assertion failures detected"; exit 1; }
exit 0
