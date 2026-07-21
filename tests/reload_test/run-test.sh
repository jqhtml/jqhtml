#!/bin/bash
cd "$(dirname "$0")"
node ../../jqhtml-tester-10-23/test-runner.js \
  test.jqhtml \
  test.js \
  data_component.jqhtml \
  data_component.js \
  --delay=5
