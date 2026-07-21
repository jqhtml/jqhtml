#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Brace-Style Control Flow"
echo "=========================================="

cd "$(dirname "$0")"

# Use the unified test runner
../../jqhtml-tester-10-23/test-runner.js test.jqhtml test.js

echo ""
echo "✅ Test complete!"
echo ""
echo "=========================================="
echo "Expected Behavior:"
echo "=========================================="
echo ""
echo "Test 1: Should show 'Message is visible!' (show_message = true)"
echo "Test 2: Should show 'Regular user' (is_admin = false)"
echo "Test 3: Should show list with Apple, Banana, Cherry"
echo "Test 4: Should show 'Items Found' with numbered items 1-3"
echo ""
echo "This validates that brace-style control flow works correctly"
echo "after removing colon-style syntax support."
