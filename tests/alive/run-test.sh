#!/bin/bash
# alive(): settles like the wrapped promise while the component lives; never settles once it
# is stopped (at the call or while waiting), swallows a late rejection, and throws in on_load().
cd "$(dirname "$0")"
exec node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  alv_child.jqhtml \
  alv_page.jqhtml \
  alv_probe.jqhtml \
  --delay=2 "$@"
