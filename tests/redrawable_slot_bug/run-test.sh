#!/bin/bash
cd "$(dirname "$0")"

echo "Running Redrawable Slot Bug Test..."
echo ""

node ../../jqhtml-tester-10-23/test-runner.js \
  test.jqhtml \
  test.js \
  parent_grid.jqhtml \
  parent_grid.js \
  child_grid.jqhtml \
  --delay=2
