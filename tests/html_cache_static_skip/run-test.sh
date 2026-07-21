#!/bin/bash

# HTML Cache Static Skip Test
#
# Tests that static components (no this.data changes in on_load)
# are NOT cached in HTML mode.
#
# VALID_MODES in test.js: ['html']
# - In 'none' mode: SKIP (instant pass)
# - In 'data' mode: SKIP (instant pass)
# - In 'html' mode: RUN assertions

cd "$(dirname "$0")"

node ../../jqhtml-tester-10-23/test-runner.js \
  test.jqhtml \
  test.js \
  static_component.jqhtml \
  static_component.js \
  dynamic_component.jqhtml \
  dynamic_component.js \
  --delay=2
