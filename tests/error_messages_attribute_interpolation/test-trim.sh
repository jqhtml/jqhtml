#!/bin/bash

echo "=========================================="
echo "Testing: Multiline Attribute Trimming"
echo "=========================================="
echo ""

cd "$(dirname "$0")"

echo "Compiling test_multiline_trim.jqhtml..."
npx jqhtml-compile compile test_multiline_trim.jqhtml --format iife > /tmp/test_multiline_trim.js 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Compiled successfully"
    echo ""
    echo "Checking for newlines in data-options attribute..."

    # Look for the data-options in the compiled output
    if grep -q 'data-options.*\\n' /tmp/test_multiline_trim.js; then
        echo "❌ FAIL: Found literal newlines in data-options"
        grep 'data-options' /tmp/test_multiline_trim.js | head -3
    else
        echo "✅ PASS: No literal newlines found in data-options"
        echo ""
        echo "Sample of data-options attribute:"
        grep 'data-options' /tmp/test_multiline_trim.js | head -1 | cut -c1-100
    fi
else
    echo "❌ Compilation failed"
    cat /tmp/test_multiline_trim.js
fi

echo ""
echo "=========================================="
