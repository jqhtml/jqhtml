#!/bin/bash

cd "$(dirname "$0")"/../../jqhtml-render-harness

# Run test - test-runner will automatically find and use test.js
node test-runner.js ../tests/shallow_find/test.jqhtml
