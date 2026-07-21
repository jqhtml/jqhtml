# Class Merging Test

Verifies that class names MERGE (not override), with no precedence rules.

## What This Tests

1. **Define classes present** - `card-base` from Define tag
2. **Invocation classes present** - `highlight shadow` from invocation
3. **Component name class auto-added** - `Base_Card`
4. **Framework marker auto-added** - `Jqhtml_Component`
5. **No duplicate classes** - Each class appears only once

## Expected Output

```
========================================
CLASS MERGING TEST:
========================================

Rendered classes: [card-base, highlight, shadow, Base_Card, Jqhtml_Component]

Expected classes:
  card-base: ✅ present
  highlight: ✅ present
  shadow: ✅ present
  Base_Card: ✅ present
  Jqhtml_Component: ✅ present

✅ No duplicate classes

✅ Correct class count (5)

========================================
✅ ALL TESTS PASSED
========================================
```

## Key Behaviors

- Class attributes **merge** (both Define and invocation classes appear)
- Component name class **always added** automatically
- `Jqhtml_Component` framework marker **always added**
- No duplicates even if same class specified twice
- Order may vary but all classes must be present
