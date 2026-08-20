#!/bin/bash

# Windows Line Endings Test
# Tests that templates with Windows line endings (\r\n) render correctly
# Bug was: CRLF line endings caused text content to disappear

cd "$(dirname "$0")"

echo "================================================"
echo "Windows Line Endings Test"
echo "================================================"
echo ""

# Check if inner.jqhtml has Windows line endings (CRLF)
if grep -q $'\r' inner.jqhtml; then
  echo "✓ inner.jqhtml already has Windows line endings (CRLF)"
else
  echo "Converting inner.jqhtml to Windows line endings (CRLF)..."
  # Use sed to add \r before each \n
  sed -i 's/$/\r/' inner.jqhtml
  echo "✓ Converted to CRLF"
fi

echo ""
echo "Running test..."
echo ""

node /var/www/html/jqhtml/jqhtml-render-harness/test-runner.js \
  outer.jqhtml \
  inner.jqhtml \
  outer.js \
  inner.js

echo ""
echo "================================================"
echo "Expected: 'Hello world!' should appear in <main> tag"
echo "Bug was: CRLF caused empty <main> tag"
echo "================================================"
