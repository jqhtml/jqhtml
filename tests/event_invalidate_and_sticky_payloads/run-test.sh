#!/bin/bash
# invalidate(event_name) and the payload a late subscriber receives from a sticky event.
cd "$(dirname "$0")"
exec node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  eis_target.jqhtml \
  --delay=1 "$@"
