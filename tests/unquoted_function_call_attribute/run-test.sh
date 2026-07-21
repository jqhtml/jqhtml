#!/bin/bash
cd "$(dirname "$0")"
node ../../jqhtml-tester-10-23/test-runner.js test.jqhtml test_child.jqhtml
