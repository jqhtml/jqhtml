#!/bin/bash

echo "=========================================="
echo "JQHTML Test: compiler text edge cases (NBSP, multi-line expressions, template literals, comma expressions)"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/compiler_text_probe.jqhtml" \
  "$SCRIPT_DIR/compiler_text_probe.js"

# Propagate the harness verdict (VERDICT: PASS/FAIL) as this script's exit code.
exit $?
