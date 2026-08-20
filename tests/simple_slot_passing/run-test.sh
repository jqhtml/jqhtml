#!/bin/bash
cd "$(dirname "$0")"

echo "Running Simple Slot Passing Test..."
echo ""

node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  test.js \
  parent_component.jqhtml \
  child_component.jqhtml \
  --delay=2
