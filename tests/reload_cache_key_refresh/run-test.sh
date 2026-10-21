#!/bin/bash
# reload() keeps the cache key in step with the args (null included) and, in html
# mode, snapshots the post-reload markup.
cd "$(dirname "$0")"
exec node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  test.js \
  rk_pager.jqhtml \
  rk_pager.js \
  --delay=3 "$@"
