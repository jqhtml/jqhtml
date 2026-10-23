#!/bin/bash
# was_ready_before(): cold on a first visit, warm on a revisit with the same cache key,
# frozen per key, opt-in (only components that ask write a marker), cleared with the
# cache scope.
cd "$(dirname "$0")"
exec node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  test.js \
  wr_leaf.jqhtml \
  wr_page.jqhtml \
  wr_page.js \
  wr_loaded.js \
  wr_custom.js \
  --delay=3 "$@"
