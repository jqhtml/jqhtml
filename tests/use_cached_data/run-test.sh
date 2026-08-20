#!/bin/bash
cd "$(dirname "$0")"
node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  cacheable_component.jqhtml \
  --delay=1
