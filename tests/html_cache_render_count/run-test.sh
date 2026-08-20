#!/bin/bash

# HTML Cache Render Count Test
#
# Tests that HTML cache mode correctly handles render execution counts:
# - First load: template renders twice, on_render called twice
# - Second load (cache hit): template renders once, on_render called twice
#
# VALID_MODES in test.js: ['html']
# - In 'none' mode: SKIP (instant pass)
# - In 'data' mode: SKIP (instant pass)
# - In 'html' mode: RUN assertions

cd "$(dirname "$0")"

node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  test.js \
  counter_component.jqhtml \
  counter_component.js \
  --delay=2
