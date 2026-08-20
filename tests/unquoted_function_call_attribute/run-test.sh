#!/bin/bash
cd "$(dirname "$0")"
node ../../jqhtml-render-harness/test-runner.js test.jqhtml test_child.jqhtml
