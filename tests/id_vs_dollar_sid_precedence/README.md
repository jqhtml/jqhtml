# ID vs $sid Precedence Test

Validates that when both `id` and `$sid` attributes are present, `$sid` takes precedence.

## What This Tests

1. **Both attributes present** - `$sid` takes precedence, element gets scoped ID
2. **Only `$sid` present** - Works normally (scoped ID)
3. **Only `id` present** - Passes through unchanged (no scoping)
4. **Original `id` ignored** - When `$sid` present, original `id` value is not accessible

## Expected Output

```
========================================
ID VS $SID PRECEDENCE TEST:
========================================

TEST 1: Both id and $sid present (should use $sid)
  this.$sid('scoped_bar'): found=true
  Actual DOM id attribute: "scoped_bar:abc123"
  Has data-sid attribute: true
  data-sid value: "scoped_bar"
✅ PASS: $sid takes precedence (scoped ID used)

TEST 2: Only $sid present (should work normally)
  this.$sid('only_scoped'): found=true
  Actual DOM id: "only_scoped:abc123"
✅ PASS: $sid works normally when alone

TEST 3: Only regular id (should pass through)
  Actual DOM id: "only_regular"
  Has data-sid: false
  Expected: id="only_regular", no data-sid
✅ PASS: Regular id passes through unchanged

TEST 4: Original id="regular_foo" should not work
  this.$sid('regular_foo'): found=false
✅ PASS: Original id name is ignored (as expected)

========================================
✅ ALL TESTS PASSED
========================================
```

## Key Behaviors

- **Precedence rule**: `$sid` wins when both present
- **Scoped IDs**: `$sid` attributes create scoped IDs (format: `name:_cid`)
- **Regular IDs**: Plain `id` attributes pass through unchanged
- **data-sid marker**: Scoped elements get `data-sid` attribute with original name
- **Accessibility**: Element only accessible via the `$sid` name, not the original `id` name
