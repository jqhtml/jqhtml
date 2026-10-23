#!/bin/bash
# is_stopped(): false through boot, ready, render() and reload(); true from the start of
# stop() (inside on_stop()), on descendants of a stopped ancestor, while the element is
# still in the DOM, and after an `await ready()` that a stop released.
cd "$(dirname "$0")"
exec node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  ist_leaf.jqhtml \
  ist_child.jqhtml \
  ist_page.jqhtml \
  ist_probe.jqhtml \
  --delay=2 "$@"
