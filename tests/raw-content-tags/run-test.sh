#!/bin/bash

cd "$(dirname "$0")"

echo "=== Testing Raw Content Tags (textarea, pre) ==="
echo ""
echo "This test validates that:"
echo "  - Textarea and pre tags preserve exact whitespace"
echo "  - No whitespace collapsing or trimming occurs"
echo "  - HTML entities are properly escaped"
echo "  - Attributes work correctly on raw tags"
echo ""

node ../../jqhtml-render-harness/test-runner.js test.jqhtml
