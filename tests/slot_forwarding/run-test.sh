#!/bin/bash
cd "$(dirname "$0")"

echo "Running Slot Forwarding Test..."
echo ""

node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  test.js \
  component_a.jqhtml \
  component_b.jqhtml \
  component_c.jqhtml \
  component_c.js \
  multi_slot_parent.jqhtml \
  multi_slot_middle.jqhtml \
  multi_slot_child.jqhtml \
  multi_slot_child.js \
  --delay=3
