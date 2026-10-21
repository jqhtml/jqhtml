#!/bin/bash
# load_method_runs_on_loaded - load() runs on_loaded() and fires 'loaded', without
# re-rendering or ready
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  "$SCRIPT_DIR/probe.jqhtml" \
  "$SCRIPT_DIR/probe.js" \
  --delay=2
# Propagate the harness verdict (VERDICT: PASS/FAIL) as this script's exit code.
exit $?
