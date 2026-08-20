#!/bin/bash

# Data Cache Unregistered Class Test
#
# Tests that ES6 class instances that are NOT registered with
# jqhtml.register_cache_class() are normalized to plain objects
# due to hot/cold cache parity in data mode.
#
# VALID_MODES in test.js: ['data']
# - In 'none' mode: SKIP (instant pass)
# - In 'data' mode: RUN assertions
# - In 'html' mode: SKIP (instant pass)

cd "$(dirname "$0")"

node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  test.js \
  test_component.jqhtml \
  test_component.js \
  unregistered_model.js \
  --delay=2
