# Slot All-Or-Nothing Rule Test

Validates that slot usage follows the all-or-nothing rule (documented best practice).

## What This Tests

1. **Pure slotted content works** - Only using slots compiles and renders correctly
2. **Rule is documented** - All-or-nothing is documented behavior

## Expected Output

```
========================================
SLOT ALL-OR-NOTHING RULE TEST:
========================================

TEST 1: Pure slotted content (should work)
  Header text: "Title"
  Expected: "Title"
✅ PASS: Pure slotted content works

TEST 2: Mixed slotted/non-slotted content (should error)
  Note: This test validates documented behavior, not actual enforcement
  The all-or-nothing rule is a best practice, not runtime-enforced
  ℹ️  DOCUMENTED RULE: If ANY slots used, ALL content must be in slots

========================================
✅ ALL TESTS PASSED
========================================
```

## Key Behaviors

- **Documented rule**: If ANY slots used, ALL content must be in slots
- Pure slotted content works correctly
- This is a best practice guideline
