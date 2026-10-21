#!/bin/bash
# loaded_without_on_load - on_loaded() and 'loaded' run for a component with no
# on_load(): at boot, reload(), refresh() and load(); suppressed by the load flags and
# on a stopped component
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/probe.jqhtml" \
  "$SCRIPT_DIR/plain.jqhtml" \
  --delay=1
# Propagate the harness verdict (VERDICT: PASS/FAIL) as this script's exit code.
exit $?
