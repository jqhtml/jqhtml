#!/bin/bash

cd "$(dirname "$0")"/../../jqhtml-tester-10-23

# Run test - test-runner will automatically find and use test.js
node test-runner.js ../tests/shallow_find/test.jqhtml
