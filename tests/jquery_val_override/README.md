# jQuery .val() Override Test

Validates that components can override the `.val()` method with custom behavior.

## What This Tests

1. **Setter returns jQuery** - `.val(value)` returns `this.$` for chaining
2. **Getter returns formatted value** - `.val()` returns uppercase
3. **Internal storage** - Input stores cleaned lowercase value
4. **Formatted display** - Span shows uppercase formatted value

## Expected Output

```
========================================
JQUERY .val() OVERRIDE TEST:
========================================

TEST 1: Setter (.val with value)
  Calling: input.$.val("Hello123!!").addClass("test-class")
  Returned type: object
  Is jQuery object: true
  Has test-class: true
✅ PASS: Setter returned jQuery object, chaining works

TEST 2: Getter (.val with no args)
  Returned value: "HELLO123"
  Expected: "HELLO123" (uppercase, special chars removed)
✅ PASS: Getter returned uppercase value

TEST 3: Formatted display
  Formatted text: "HELLO123"
  Expected: "HELLO123"
✅ PASS: Formatted display shows uppercase

TEST 4: Internal storage
  Internal input value: "hello123"
  Expected: "hello123" (lowercase, cleaned)
✅ PASS: Internal input stores lowercase cleaned value

========================================
✅ ALL TESTS PASSED
========================================
```

## Key Behaviors

- Component can override `.val()` with custom getter/setter
- Setter cleans input (removes special chars, converts to lowercase)
- Getter returns formatted value (uppercase)
- Setter returns `this.$` to enable jQuery chaining
- Internal input and displayed value can differ
