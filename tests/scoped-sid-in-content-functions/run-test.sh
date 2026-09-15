#!/bin/bash

cd "$(dirname "$0")"

echo "=== Testing Scoped IDs in Content Functions ==="
echo ""
echo "This test validates that:"
echo "  - Elements with \$sid defined in Parent's render function"
echo "  - Are scoped with Parent's _cid (not Child's _cid)"
echo "  - Even when rendered inside Child component via content()"
echo ""

node ../../jqhtml-render-harness/test-runner.js parent.jqhtml child.jqhtml
