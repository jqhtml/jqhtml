#!/bin/bash
# render_sid_lookup_errors - render(sid)/redraw(sid)/_render(sid) share one child lookup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/../../jqhtml-render-harness/test-runner.js" \
  "$SCRIPT_DIR/test.jqhtml" \
  "$SCRIPT_DIR/test.js" \
  --delay=2
# Propagate the harness verdict (VERDICT: PASS/FAIL) as this script's exit code.
exit $?
