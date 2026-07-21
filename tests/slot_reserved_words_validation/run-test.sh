#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "========================================"
echo "SLOT RESERVED WORDS VALIDATION TEST:"
echo "========================================"
echo ""

# TEST 1: Bad slot name should fail
echo "TEST 1: Compiling bad_slot_function.jqhtml (should FAIL)"
if node "$SCRIPT_DIR/../../packages/parser/bin/jqhtml-compile" "$SCRIPT_DIR/bad_slot_function.jqhtml" > /dev/null 2>&1; then
  echo "❌ FAIL: bad_slot_function.jqhtml compiled successfully (should have failed)"
  TEST1=false
else
  echo "✅ PASS: bad_slot_function.jqhtml failed to compile (expected)"
  TEST1=true

  # Check error message
  ERROR_MSG=$(node "$SCRIPT_DIR/../../packages/parser/bin/jqhtml-compile" "$SCRIPT_DIR/bad_slot_function.jqhtml" 2>&1 || true)
  if echo "$ERROR_MSG" | grep -qi "reserved"; then
    echo "  ✅ Error message mentions 'reserved'"
  else
    echo "  ⚠️  Error message doesn't mention 'reserved'"
    echo "  Error: $ERROR_MSG"
  fi
fi
echo ""

# TEST 2: Good slot name should succeed
echo "TEST 2: Compiling good_slot.jqhtml (should PASS)"
if node "$SCRIPT_DIR/../../packages/parser/bin/jqhtml-compile" "$SCRIPT_DIR/good_slot.jqhtml" > /dev/null 2>&1; then
  echo "✅ PASS: good_slot.jqhtml compiled successfully"
  TEST2=true
else
  echo "❌ FAIL: good_slot.jqhtml failed to compile (should have succeeded)"
  ERROR_MSG=$(node "$SCRIPT_DIR/../../packages/parser/bin/jqhtml-compile" "$SCRIPT_DIR/good_slot.jqhtml" 2>&1 || true)
  echo "  Error: $ERROR_MSG"
  TEST2=false
fi
echo ""

# TEST 3: Try other reserved words
echo "TEST 3: Testing other reserved words"
RESERVED_WORDS=("if" "for" "class" "return" "while")
ALL_RESERVED_FAIL=true

for word in "${RESERVED_WORDS[@]}"; do
  TMP_FILE="/tmp/test_slot_$word.jqhtml"
  echo "<Define:Test_$word><#$word>content</#$word></Define:Test_$word>" > "$TMP_FILE"

  if node "$SCRIPT_DIR/../../packages/parser/bin/jqhtml-compile" "$TMP_FILE" > /dev/null 2>&1; then
    echo "  ⚠️  Slot name '$word' compiled (should fail)"
    ALL_RESERVED_FAIL=false
  else
    echo "  ✅ Slot name '$word' failed to compile (expected)"
  fi
  rm -f "$TMP_FILE"
done

if [ "$ALL_RESERVED_FAIL" = true ]; then
  echo "✅ PASS: All reserved words rejected"
  TEST3=true
else
  echo "❌ FAIL: Some reserved words were NOT rejected"
  TEST3=false
fi
echo ""

# Final result
echo "========================================"
if [ "$TEST1" = true ] && [ "$TEST2" = true ] && [ "$TEST3" = true ]; then
  echo "✅ ALL TESTS PASSED"
else
  echo "❌ SOME TESTS FAILED"
fi
echo "========================================"
echo ""
