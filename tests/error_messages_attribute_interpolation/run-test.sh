#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Attribute Interpolation Error Messages"
echo "=========================================="
echo ""

cd "$(dirname "$0")"

echo "🔨 Test 1: Invalid pattern (should fail with clear error)"
echo "Pattern: \$options=<%= JSON.stringify(...) %>"
echo ""

npx jqhtml-compile compile test_invalid.jqhtml --format iife 2>&1 | head -20

echo ""
echo "=========================================="
echo ""
echo "🔨 Test 2: Valid pattern (should succeed)"
echo "Pattern: \$options=\"<%= JSON.stringify(...) %>\""
echo ""

if npx jqhtml-compile compile test_valid.jqhtml --format iife > /dev/null 2>&1; then
    echo "✅ Valid pattern compiled successfully"
else
    echo "❌ Valid pattern failed to compile (unexpected)"
fi

echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "Test 1 should fail with error explaining:"
echo "  - Cannot assign attribute directly to <%= %> block"
echo "  - Use quotes: attr=\"<%= value %>\""
echo "  - Or for \$ attributes: \$attr=value (literal JS)"
echo ""
echo "Test 2 should compile successfully."
