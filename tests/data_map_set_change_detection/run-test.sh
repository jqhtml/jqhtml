#!/bin/bash
# Map / Set change detection: data loaded into a Map or Set re-renders, refresh()
# and load() see changes inside it, and identical contents still skip the render.
cd "$(dirname "$0")"
exec node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  test.js \
  map_loader.jqhtml \
  map_loader.js \
  set_loader.jqhtml \
  set_loader.js \
  --delay=3 "$@"
