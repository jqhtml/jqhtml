#!/bin/bash
cd "$(dirname "$0")"
node ../../jqhtml-tester-10-23/test-runner.js \
  test.jqhtml \
  component_with_create_data.jqhtml \
  component_with_create_data.js
