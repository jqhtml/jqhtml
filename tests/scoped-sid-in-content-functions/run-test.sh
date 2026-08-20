#!/bin/bash

cd /var/www/html/jqhtml/tests/scoped-id-in-content-functions

echo "=== Testing Scoped IDs in Content Functions ==="
echo ""
echo "This test validates that:"
echo "  - Elements with \$id defined in Parent's render function"
echo "  - Should be scoped with Parent's _cid (not Child's _cid)"
echo "  - Even when rendered inside Child component via content()"
echo ""

# Run the test with the unified test runner (parent.jqhtml is main, child.jqhtml is dependency)
node /var/www/html/jqhtml/jqhtml-render-harness/test-runner.js parent.jqhtml child.jqhtml
