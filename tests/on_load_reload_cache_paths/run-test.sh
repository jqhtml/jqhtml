#!/bin/bash
# reload()/refresh()/load() decisions for a component with on_load(): the
# args-changed cache path, skip-if-unchanged, re-render-if-changed, in every mode.
cd "$(dirname "$0")"
exec node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  test.js \
  pager.jqhtml \
  pager.js \
  --delay=3 "$@"
