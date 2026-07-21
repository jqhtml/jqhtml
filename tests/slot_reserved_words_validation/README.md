# Slot Reserved Words Validation Test

Validates that parser rejects slot names that are JavaScript reserved words.

## What This Tests

1. **Reserved word slots fail compilation** - `<#function>`, `<#if>`, `<#for>`, etc. cause errors
2. **Error message mentions reserved** - Clear indication of the problem
3. **Valid slot names compile** - Non-reserved words like `<#header>` work fine

## Expected Output

```
========================================
SLOT RESERVED WORDS VALIDATION TEST:
========================================

TEST 1: Compiling bad_slot_function.jqhtml (should FAIL)
✅ PASS: bad_slot_function.jqhtml failed to compile (expected)
  ✅ Error message mentions 'reserved'

TEST 2: Compiling good_slot.jqhtml (should PASS)
✅ PASS: good_slot.jqhtml compiled successfully

TEST 3: Testing other reserved words
  ✅ Slot name 'if' failed to compile (expected)
  ✅ Slot name 'for' failed to compile (expected)
  ✅ Slot name 'class' failed to compile (expected)
  ✅ Slot name 'return' failed to compile (expected)
  ✅ Slot name 'while' failed to compile (expected)
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
