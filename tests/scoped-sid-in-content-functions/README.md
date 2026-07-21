# Scoped IDs in Content Functions Test

## Purpose

Validates that scoped IDs (`$sid`) and `this` context are correctly bound when elements are defined in a parent component's content function but rendered inside a child component.

## What This Tests

### Core Behavior

When a parent component invokes a child component with content:

```jqhtml
<Define:Parent_Component>
  <Child_Component>
    <div $sid="element_defined_in_parent">
      <%= this.data.parent_value %>
    </div>
  </Child_Component>
</Define:Parent_Component>
```

**Expected behavior:**
1. The `$sid` should be scoped with **Parent's `_cid`**, not Child's
2. The `this` context should refer to **Parent component instance**
3. `this.data.parent_value` should access Parent's data

### Test Results

**Parent CID:** `a7c427heh`
**Child CID:** `gwqdhqd12`

**Element with $sid:**
```html
<div id="element_defined_in_parent:a7c427heh"
     data-sid="element_defined_in_parent"
     class="content-element">
  <p>Accessing parent's this.data: <span class="parent-this-data">DATA_FROM_PARENT</span></p>
</div>
```

✅ **Scoped ID uses Parent's CID** (`a7c427heh`)
✅ **`this.data` accesses Parent's data** (`DATA_FROM_PARENT`)

## Why This Matters

This test validates the fundamental principle of content functions:

**Content functions are anonymous render functions that:**
1. Are defined in the parent component's render function
2. Execute with `.bind(this)` where `this` = parent component instance
3. Generate elements that are scoped to the parent, not the child

This allows:
- Parent components to reference child elements with `this.$sid('element_defined_in_parent')`
- Content to access parent's data via `this.data`
- Proper component encapsulation

## Implementation Details

### Compiled Code Structure

```javascript
// Parent's render function
render() {
  return {
    comp: [
      "Child_Component",
      {
        "id": "element_defined_in_parent" + ":" + this._cid,  // Parent's _cid
        "data-sid": "element_defined_in_parent"
      },
      function(Child_Instance) {
        // Content function
        // 'this' = Parent_Instance (via .bind())
        return `<div>${this.data.parent_value}</div>`;
      }.bind(this)  // ← Binds to Parent_Instance
    ]
  };
}
```

### Runtime Processing

1. Parent's render function executes
2. Scoped ID generated: `"element_defined_in_parent:" + parent._cid`
3. Content function created with `.bind(parent_instance)`
4. Child component created
5. Child's render calls `content()` which executes the bound function
6. Content renders with `this` = parent, scoped IDs use parent's `_cid`

## Related Files

- **Codegen**: `/packages/parser/src/codegen.ts` - Generates scoped IDs with `this._cid`
- **Instruction Processor**: `/packages/core/src/instruction-processor.ts` - Processes component invocations
- **Component Base**: `/packages/core/src/component.ts` - `this.$sid()` method for accessing scoped elements

## Running the Test

```bash
cd tests/scoped-id-in-content-functions
./run-test.sh
```

**Expected output:**
- Parent CID and Child CID are different
- Element's `id` uses Parent's CID
- Element accesses Parent's data via `this.data.parent_value`
