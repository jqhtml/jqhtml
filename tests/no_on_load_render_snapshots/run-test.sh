#!/bin/bash
# Components without on_load(): render()/reload()/refresh()/load() behave exactly
# as before now that _render() records no reload snapshots for them.
cd "$(dirname "$0")"
exec node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  test.js \
  plain_counter.jqhtml \
  plain_counter.js \
  plain_row.jqhtml \
  --delay=3 "$@"
