#!/bin/bash
# reload() writes the cache under a new key even when the data is unchanged, and marks
# or unmarks data-nocache (with the dev warning) exactly as boot and load() do.
cd "$(dirname "$0")"
exec node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  test.js \
  rn_item.jqhtml \
  rn_item.js \
  --delay=3 "$@"
