#!/bin/bash

# Test runner for raw content tags
cd /var/www/html/jqhtml/tests/raw-content-tags

echo "=== Testing Raw Content Tags (textarea, pre) ==="
echo ""
echo "This test validates that:"
echo "  - Textarea and pre tags preserve exact whitespace"
echo "  - No whitespace collapsing or trimming occurs"
echo "  - HTML entities are properly escaped"
echo "  - Attributes work correctly on raw tags"
echo ""

# Run the test with the unified test runner (only .jqhtml file)
node /var/www/html/jqhtml/jqhtml-tester-10-23/test-runner.js test.jqhtml
