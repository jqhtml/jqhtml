#!/bin/bash
# attribute_character_references - quoted attribute values mean what static HTML means
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/acr_child.jqhtml" \
  --delay=2
# Propagate the harness verdict (VERDICT: PASS/FAIL) as this script's exit code.
exit $?
