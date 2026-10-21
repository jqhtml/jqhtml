#!/bin/bash
# style_merge_css_values - style merging splits declarations like the CSS tokenizer
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/smc_base.jqhtml" \
  "$SCRIPT_DIR/smc_near.jqhtml" \
  "$SCRIPT_DIR/smc_important.jqhtml" \
  --delay=2
# Propagate the harness verdict (VERDICT: PASS/FAIL) as this script's exit code.
exit $?
