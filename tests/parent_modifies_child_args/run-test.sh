#!/bin/bash
cd "$(dirname "$0")"

echo "Running Parent Modifies Child Args Test..."
echo ""
echo "Expected Behavior:"
echo "  - Child on_load() called TWICE"
echo "  - First call: filter='initial'"
echo "  - Second call: filter='modified_by_parent' (after 500ms)"
echo ""

node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  test.js \
  parent_component.jqhtml \
  parent_component.js \
  child_component.jqhtml \
  child_component.js \
  --delay=3
