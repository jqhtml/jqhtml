#!/bin/bash
# @click handlers (and instantiator()) in slot bodies bind to the component whose
# template wrote them on three paths: a slot-only template (extends= and JS class
# chain), slot content after the receiving component re-renders, and a slot body
# forwarded through a middle component to a third one.
cd "$(dirname "$0")"
exec node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  shb_marker.jqhtml \
  shb_grid_base.jqhtml \
  shb_extends_grid.jqhtml \
  shb_class_grid.jqhtml \
  shb_box.jqhtml \
  shb_leaf.jqhtml \
  shb_middle.jqhtml \
  --delay=2 "$@"
