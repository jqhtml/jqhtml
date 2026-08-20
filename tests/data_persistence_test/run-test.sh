#!/bin/bash
cd "$(dirname "$0")"
node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  component_with_create_data.jqhtml \
  component_with_create_data.js
