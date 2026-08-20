#!/bin/bash
cd "$(dirname "$0")"
node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  test.js \
  data_component.jqhtml \
  data_component.js \
  --delay=5
