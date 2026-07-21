# Test: Interpolated Attribute Expressions

## Purpose

Validates that expressions embedded within HTML attribute values preserve correct JavaScript operator precedence when compiled.

## The Bug (Fixed in v2.2.153)

When using expressions with operators inside attribute interpolations, the code generator was not wrapping expressions in parentheses, causing operator precedence issues.

### Example Bug

**Template:**
```jqhtml
<li class="page-item <%= pageNum === currentPage ? 'active' : '' %>">
```

**Generated (WRONG - before fix):**
```javascript
{"class": "page-item " + pageNum === currentPage ? 'active' : ''}
```

This evaluated as `("page-item " + pageNum) === currentPage ? 'active' : ''` due to `+` having higher precedence than `===`. The comparison would always be false, resulting in empty string.

**Generated (CORRECT - after fix):**
```javascript
{"class": "page-item " + (pageNum === currentPage ? 'active' : '')}
```

Now correctly evaluates as `"page-item " + (true ? 'active' : '')` → `"page-item active"`

## What This Test Validates

1. **Ternary operators** - `condition ? 'a' : 'b'` in attributes
2. **Logical operators** - `&&`, `||` in attributes
3. **Comparison operators** - `===`, `>`, `<` in attributes
4. **Mixed interpolation** - Static text combined with expressions
5. **Loop contexts** - Expressions using loop variables

## Expected Behavior

All expressions should evaluate correctly:

- Test 1: `class="my-class"` (simple variable)
- Test 2: `class="active"` (ternary operator)
- Test 3: `class="static active"` (mixed static + expression)
- Test 4: `class="item-1"`, `class="item-2"`, `class="item-3"` (loop interpolation)
- Test 5: Second `<li>` has `class="page-item active"` (loop + ternary)
- Test 6: `class="visible"` (logical AND)
- Test 7: `class="hidden"` (logical OR)
- Test 8: `class="not-first"` (comparison operator)

## Running the Test

```bash
cd tests/interpolated_attribute_expressions
./run-test.sh
```

## Implementation Details

### Fix Location

**File:** `/packages/parser/src/codegen.ts`
**Function:** `generate_attributes_object()`
**Lines:** ~1232-1234

### The Fix

When generating attribute values with interpolated expressions, wrap expression parts in parentheses:

```typescript
// Before
return part.value;

// After
return `(${part.value})`;
```

This ensures proper operator precedence regardless of which operators are used in the expression.

### Why Parentheses Are Needed

JavaScript operator precedence (high to low):
1. `+` (string concatenation)
2. `===`, `>`, `<` (comparison)
3. `&&`, `||` (logical)
4. `?:` (ternary)

Without parentheses, `"a" + x ? 'b' : 'c'` is parsed as `("a" + x) ? 'b' : 'c'`, not `"a" + (x ? 'b' : 'c')`.

## Related Files

- `/packages/parser/src/codegen.ts` - Code generation
- `/packages/parser/src/lexer.ts` - Template tokenization
- `/packages/parser/src/parser.ts` - AST construction

## Regression Prevention

This test serves as a regression guard. If the fix is accidentally reverted, Test 5 will immediately show the bug - the second `<li>` will have `class="page-item "` (no "active") instead of `class="page-item active"`.
