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
  if echo "$ERROR_MSG" | grep -q 'Slot name "function" is a JavaScript reserved word'; then
    echo "  ✅ Error message names the reserved slot"
  else
    echo "  ❌ FAIL: error is not the reserved-word rejection"
    echo "  Error: $ERROR_MSG"
    TEST1=false
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
# A private directory: the suite runs this script three times at once (one per cache
# mode), and a shared fixed /tmp path let one run delete the file another was compiling -
# which then "failed to compile" and counted as the expected rejection.
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

for word in "${RESERVED_WORDS[@]}"; do
  TMP_FILE="$TMP_DIR/test_slot_$word.jqhtml"
  echo "<Define:Test_$word><Slot:$word>content</Slot:$word></Define:Test_$word>" > "$TMP_FILE"

  # Must fail with THE reserved-word error - any other compile error is not a pass.
  if ERROR_MSG=$(node "$SCRIPT_DIR/../../packages/parser/bin/jqhtml-compile" "$TMP_FILE" 2>&1); then
    echo "  ❌ Slot name '$word' compiled (should fail)"
    ALL_RESERVED_FAIL=false
  elif echo "$ERROR_MSG" | grep -q "Slot name \"$word\" is a JavaScript reserved word"; then
    echo "  ✅ Slot name '$word' rejected as a reserved word (expected)"
  else
    echo "  ❌ Slot name '$word' failed with a different error: $ERROR_MSG"
    ALL_RESERVED_FAIL=false
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
  STATUS=0
else
  echo "❌ SOME TESTS FAILED"
  STATUS=1
fi
echo "========================================"
echo ""

# This script tests the compiler directly (no harness), so it prints the verdict line
# the suite runner requires itself.
if [ $STATUS -eq 0 ]; then
  echo "VERDICT: PASS"
else
  echo "VERDICT: FAIL (TEST1=$TEST1 TEST2=$TEST2 TEST3=$TEST3)"
fi
exit $STATUS
