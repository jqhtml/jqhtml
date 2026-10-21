#!/bin/bash

echo "=========================================="
echo "JQHTML Test: Attribute Interpolation Error Messages"
echo "=========================================="
echo ""

cd "$(dirname "$0")"
FAILED=0

# expect_error FILE TEXT... - FILE must fail to compile, and its error must contain each TEXT
expect_error() {
  local file="$1"; shift
  local out
  if out=$(npx jqhtml-compile compile "$file" --format iife 2>&1); then
    echo "❌ $file compiled (expected an error)"
    FAILED=1
    return
  fi
  echo "$out" | head -24
  for text in "$@"; do
    if ! grep -qF -- "$text" <<< "$out"; then
      echo "❌ $file: error does not mention: $text"
      FAILED=1
    fi
  done
}

echo "🔨 Test 1: Invalid pattern \$options=<%= ... %> (unquoted)"
echo ""
expect_error test_invalid.jqhtml \
  "Attribute value cannot be assigned directly to <%= %> interpolation block" \
  '$options=(JSON.stringify(data))'

echo ""
echo "=========================================="
echo ""
echo "🔨 Test 2: Invalid pattern \$options=\"<%= ... %>\" spanning lines"
echo ""
expect_error test_multiline_quoted.jqhtml \
  "A <%= %> expression in an attribute value must be on one line" \
  '$options=(JSON.stringify(['

echo ""
echo "=========================================="
echo ""
echo "🔨 Test 3: Valid patterns (bracketed multi-line \$ value, one-line quoted interpolation)"
echo ""
if npx jqhtml-compile compile test_valid.jqhtml --format iife > /dev/null 2>&1; then
  echo "✅ Valid patterns compiled successfully"
else
  echo "❌ Valid patterns failed to compile (unexpected)"
  FAILED=1
fi

# This script tests the compiler directly (no harness), so it prints the verdict line
# the suite runner requires itself.
echo ""
if [ $FAILED -eq 0 ]; then
  echo "VERDICT: PASS"
else
  echo "VERDICT: FAIL (see the ❌ lines above)"
fi
exit $FAILED
