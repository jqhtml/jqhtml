#!/bin/bash
cd "$(dirname "$0")"

echo "Running on_load() Restrictions Test..."
echo ""

node ../../jqhtml-tester-10-23/test-runner.js \
  test.jqhtml \
  test.js \
  test_component.jqhtml \
  test_component.js \
  --delay=2
