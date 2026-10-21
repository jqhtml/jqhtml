#!/bin/bash

echo "=========================================="
echo "JQHTML Test: // comments (run to end of line) and regex literals in template code"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/js_regions_probe.jqhtml" \
  "$SCRIPT_DIR/js_regions_probe.js"

# Propagate the harness verdict (VERDICT: PASS/FAIL) as this script's exit code.
exit $?
