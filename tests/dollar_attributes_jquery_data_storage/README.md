# Dollar Attributes jQuery Data Storage Test

## Purpose

Validates that `$` attributes are stored via jQuery's `.data()` in-memory storage and are **NOT rendered as `data-*` DOM attributes**.

This is a **critical architectural detail** - `$` attributes provide component parameters without polluting the DOM with visible attributes.

## What This Tests

1. **jQuery .data() storage**: `$product_id="123"` accessible via `this.$.data('product_id')`
2. **No DOM attributes**: `data-product-id="123"` does NOT appear in rendered HTML
3. **In-memory only**: Values stored in jQuery's internal data cache
4. **Available via this.args**: Primary access through `this.args.product_id`
5. **Dual access**: Both `this.args.x` and `this.$.data('x')` work

## Expected Behavior

### Template Usage
```jqhtml
<Component $product_id="123" $category="electronics" />
```

### Component Access
```javascript
class Component extends Jqhtml_Component {
  on_ready() {
    // Primary access via this.args
    console.log(this.args.product_id);  // "123"

    // Also available via jQuery .data()
    console.log(this.$.data('product_id'));  // "123"

    // NOT in DOM
    console.log(this.$.attr('data-product-id'));  // undefined
  }
}
```

### DOM Inspection
```html
<!-- DOM should NOT contain data-product-id or data-category -->
<div class="Component Jqhtml_Component" data-cid="abc123">
  <!-- No data-product-id or data-category attributes visible -->
</div>
```

## Pass Criteria

✅ **Test passes if:**
1. `this.$.data('key')` returns value from `$key` attribute
2. `this.args.key` and `this.$.data('key')` have same value
3. DOM does NOT contain `data-key` attributes
4. HTML inspection confirms no $ attribute values in markup
5. Values stored in jQuery's in-memory cache only

❌ **Test fails if:**
- `data-*` attributes appear in DOM
- `.data()` returns undefined
- Values not accessible
- $ attributes leak into rendered HTML

## Related Documentation

- CLAUDE.md: $ Attributes (Component Parameters)
- docs/official/03_dollar_attribute_system.md: Storage mechanism
