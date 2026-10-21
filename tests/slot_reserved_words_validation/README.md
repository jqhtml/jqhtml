# Slot Reserved Words Validation Test

Validates that parser rejects slot names that are JavaScript reserved words.

## What This Tests

1. **Reserved word slots fail compilation** - `<Slot:function>`, `<Slot:if>`, `<Slot:for>`, etc. cause errors
2. **The error is the reserved-word rejection** - `Slot name "if" is a JavaScript reserved word ...`; any other compile error fails the test
3. **Valid slot names compile** - Non-reserved words like `<Slot:header>` work fine

## Expected Output

```
========================================
SLOT RESERVED WORDS VALIDATION TEST:
========================================

TEST 1: Compiling bad_slot_function.jqhtml (should FAIL)
✅ PASS: bad_slot_function.jqhtml failed to compile (expected)
  ✅ Error message names the reserved slot

TEST 2: Compiling good_slot.jqhtml (should PASS)
✅ PASS: good_slot.jqhtml compiled successfully

TEST 3: Testing other reserved words
  ✅ Slot name 'if' rejected as a reserved word (expected)
  ✅ Slot name 'for' rejected as a reserved word (expected)
  ✅ Slot name 'class' rejected as a reserved word (expected)
  ✅ Slot name 'return' rejected as a reserved word (expected)
  ✅ Slot name 'while' rejected as a reserved word (expected)
✅ PASS: All reserved words rejected

========================================
✅ ALL TESTS PASSED
========================================
```

## Key Behaviors

- Parser validates slot names against JavaScript reserved words
- Compilation fails with clear error message
- Prevents runtime JavaScript errors
- Valid slot names (non-reserved) compile successfully
