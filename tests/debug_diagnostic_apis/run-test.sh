#!/bin/bash
# debug_diagnostic_apis - regression test for window.jqhtml debug/diagnostic APIs
# (list_components, get_component_names, get_registered_templates, _version,
#  enableDebugMode, setDebugSettings, clearDebugSettings)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OUT=$(node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/debug_diagnostic_apis_test.jqhtml" \
  "$SCRIPT_DIR/debug_diagnostic_apis_test.js" \
  --delay=2 2>&1)
STATUS=$?
echo "$OUT"

[ $STATUS -ne 0 ] && exit $STATUS
echo "$OUT" | grep -q "ALL TESTS PASSED" || { echo "❌ Assertion failures detected"; exit 1; }
exit 0
