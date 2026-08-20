#!/bin/bash

# Mode-Specific Test Example
#
# This test demonstrates how tests can declare which cache modes they apply to.
# When run in a mode that doesn't apply, the test instantly passes.
#
# VALID_MODES in test.js: ['data']
# - In 'none' mode: SKIP (instant pass)
# - In 'data' mode: RUN assertions
# - In 'html' mode: SKIP (instant pass)

cd "$(dirname "$0")"

node ../../jqhtml-render-harness/test-runner.js \
  test.jqhtml \
  test.js \
  --delay=1
