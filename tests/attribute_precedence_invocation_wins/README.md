# Attribute Precedence Test

Verifies that for non-class attributes, invocation values override Define values.

## What This Tests

1. **Tag override** - `tag="span"` at invocation overrides `tag="button"` in Define
2. **Style override** - `style="color: blue;"` overrides `style="color: red;"`
3. **Data attribute override** - `data-theme="dark"` overrides `data-theme="light"`
4. **Class merging (exception)** - Classes merge instead of override

## Expected Output

```
========================================
ATTRIBUTE PRECEDENCE TEST:
========================================

Tag name: span
  Expected: span (invocation override)
  Define had: button

Style: color: blue;
  Expected: color: blue; (invocation wins)
  Define had: color: red;

data-theme: dark
  Expected: dark (invocation wins)
  Define had: light

Classes: btn, btn-primary, Button_With_Defaults, Jqhtml_Component
  Expected: btn AND btn-primary (merged)
  Define had: btn
  Invocation added: btn-primary

========================================
VALIDATION:
========================================

✅ TEST 1 PASS: Tag is span (invocation override worked)
✅ TEST 2 PASS: Style is blue (invocation wins)
✅ TEST 3 PASS: data-theme is dark (invocation wins)
✅ TEST 4 PASS: Both btn and btn-primary classes present (merged)

========================================
✅ ALL TESTS PASSED
========================================
```

## Key Behaviors

- **Regular attributes**: Invocation overrides Define
- **`class` attribute**: Exception - merges instead of override
- **`tag` attribute**: Invocation overrides Define
- This allows Define to provide defaults that can be overridden at invocation
