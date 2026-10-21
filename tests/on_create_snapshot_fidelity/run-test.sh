#!/bin/bash
# on_create() snapshot fidelity: on_load() receives Date, Map, Set, undefined-valued
# keys and register_cache_class() instances exactly as on_create() set them.
cd "$(dirname "$0")"
exec node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  test.js \
  fidelity_model.js \
  fidelity_widget.jqhtml \
  fidelity_widget.js \
  --delay=3 "$@"
