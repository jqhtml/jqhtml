# Component Replacement Test

## Purpose

Tests that calling `$(selector).component("Component_Name")` on an element that already has a component properly:

1. **Stops the existing component** - Calls `.stop()` with error handling
2. **Removes component classes** - Strips all classes starting with capital letters
3. **Removes component data** - Cleans up `_component` data
4. **Creates new component** - Instantiates and boots the new component

## What This Tests

### Scenario

A parent component creates a child component on an element, waits for it to be ready, then replaces it with a different component using the jQuery plugin setter syntax.

### Expected Behavior

1. First component renders its content
2. First component's CSS classes are applied
3. When replacement happens:
   - Old component's `.stop()` is called (with try/catch)
   - Old component's classes (starting with capital letters) are removed
   - New component is created and initialized
   - New component's content replaces old content
   - New component's classes are applied

### Validation Checks

1. ✅ Second_Component content is present
2. ✅ First_Component content was removed
3. ✅ First_Component class was removed
4. ✅ Second_Component class was added

## Implementation Details

### Component Lifecycle During Replacement

```javascript
// Element has First_Component
this.$sid('target').component('Second_Component');

// Internally:
// 1. Detect existingComponent = element.data('_component')
// 2. try { existingComponent.stop(); } catch {}
// 3. Remove capital-letter classes from element
// 4. Remove _component data
// 5. Create new Second_Component instance
// 6. Boot new component
```

### Class Removal Logic

Only classes starting with capital letters are removed (component classes):
- `First_Component` → REMOVED
- `Component` → REMOVED
- `my-custom-class` → KEPT
- `active` → KEPT

### Error Handling

The `stop()` call is wrapped in try/catch to continue on errors, ensuring replacement succeeds even if the old component's cleanup fails.

## Files

- `first_component.jqhtml` - Simple component with distinctive content
- `second_component.jqhtml` - Replacement component with different content
- `test_container.jqhtml` - Parent component that performs replacement
- `test_container.js` - Test logic and validation
- `run-test.sh` - Test runner script

## Related Source

- `/packages/core/src/jquery-plugin.ts` - Component replacement logic (lines 163-186)
- `/packages/core/src/component.ts` - Component.stop() method

## Running the Test

```bash
cd tests/component_replacement
./run-test.sh
```

Expected output: All 4 validation checks pass.
