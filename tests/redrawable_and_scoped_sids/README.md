# Test: $redrawable and Scoped ID Behavior

## Purpose

This test validates two critical JQHTML features:

1. **$redrawable attribute** - Makes any HTML element independently re-renderable without creating a custom component
2. **Scoped IDs ($sid)** - Prevents ID collisions by scoping element IDs to their parent component

## What This Test Demonstrates

### 1. $redrawable Transformation

```jqhtml
<span $redrawable $sid="test_span" class="badge">
  Counter: 42
</span>
```

**Transforms to:**
```html
<span id="test_span:PARENT_CID" data-sid="test_span"
      class="badge Redrawable Jqhtml_Component"
      data-cid="COMPONENT_CID">
  Counter: 42
</span>
```

The parser automatically wraps `$redrawable` elements in a `Redrawable` component, allowing you to call `this.render('test_span')` to update just that element.

### 2. Scoped ID Behavior

#### HTML Tags with $sid
```jqhtml
<p $sid="test_p">Content</p>
```

**Renders as:**
```html
<p id="test_p:PARENT_CID" data-sid="test_p">Content</p>
```

#### Components with $sid
```jqhtml
<TestUndefined $sid="test_id">Content</TestUndefined>
```

**Renders as:**
```html
<div id="test_id:PARENT_CID" data-sid="test_id"
     class="TestUndefined Jqhtml_Component"
     data-cid="COMPONENT_CID">
  Content
</div>
```

### 3. Regular ID Pass-Through

#### HTML Tags with id
```jqhtml
<section id="regular_section_id">Content</section>
```

**Renders as:**
```html
<section id="regular_section_id">Content</section>
```

#### Components with id
```jqhtml
<AnotherUndefined id="regular_component_id">Content</AnotherUndefined>
```

**Renders as:**
```html
<div id="regular_component_id"
     class="AnotherUndefined Jqhtml_Component"
     data-cid="COMPONENT_CID">
  Content
</div>
```

### 4. Precedence: $sid vs id

When both attributes are present, `$sid` takes precedence:

```jqhtml
<article id="regular_article_id" $sid="scoped_article_id">Content</article>
```

**Renders as:**
```html
<article id="scoped_article_id:PARENT_CID" data-sid="scoped_article_id">
  Content
</article>
```

## Critical Implementation Details

### Scoping Uses Parent Component's _cid

**All scoped IDs use the PARENT component's `_cid`, NOT the element's own `data-cid`.**

```jqhtml
<Define:Parent_Component>
  <div $sid="child_element">Content</div>
  <Child_Component $sid="child_component" />
</Define:Parent_Component>
```

**Renders as:**
```html
<!-- Parent_Component has _cid = "abc123" -->
<div id="child_element:abc123" data-sid="child_element">Content</div>
<div id="child_component:abc123" data-sid="child_component"
     class="Child_Component"
     data-cid="xyz789">
  Content
</div>
```

**Why parent's _cid?**
- Components can call `this.$sid('child_element')` to find elements scoped to them
- The scoping happens at **render time**, before child components are instantiated
- Child components don't have their own `_cid` yet during HTML generation
- This creates a consistent scoping mechanism across all element types

### Accessing Scoped Elements

From within a component:

```javascript
class Parent_Component extends Jqhtml_Component {
  on_ready() {
    // Find element by scoped ID
    this.$sid('child_element').text('Updated');

    // Get component instance by scoped ID
    const childComponent = this.id('child_component');

    // Regular jQuery still works for non-scoped IDs
    $('#regular_section_id').addClass('active');
  }
}
```

## Running the Test

```bash
./run-test.sh
```

Or manually:
```bash
node ../../jqhtml-tester-10-23/test-runner.js test.jqhtml
```

## Expected Output

All elements should render with correct ID attributes:

1. ✅ HTML tags with `$sid` → scoped to parent's `_cid`
2. ✅ Components with `$sid` → scoped to parent's `_cid`
3. ✅ HTML tags with `id` → passed through unchanged
4. ✅ Components with `id` → passed through unchanged
5. ✅ Elements with both → `$sid` takes precedence
6. ✅ `$redrawable` elements → become Redrawable components with scoped IDs

## Implementation Files

- **Parser**: `/packages/parser/src/parser.ts` - Converts `$sid` → `data-sid`
- **Codegen**: `/packages/parser/src/codegen.ts` - Generates scoped ID attributes in compiled output
- **Runtime**: `/packages/core/src/instruction-processor.ts` - Applies scoped IDs during HTML generation
- **Component API**: `/packages/core/src/component.ts` - `$sid()` and `id()` methods

## Related Documentation

See `CLAUDE.md` section on "Scoped IDs (Prevent ID Collisions)" for usage examples and API reference.
