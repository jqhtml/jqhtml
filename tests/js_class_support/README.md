# Test: JS Class Support

## Purpose

This test validates that the JQHTML test runner correctly loads and registers paired `.js` files containing ES6 component classes.

## What This Test Demonstrates

### Paired File Pattern

```
test.jqhtml  →  Template definition
test.js      →  Component class with lifecycle methods
```

Both files share the same basename (`test`), and the test runner automatically:
1. Compiles the `.jqhtml` template to JavaScript
2. Detects the paired `.js` file
3. Inlines the JS class code before the template
4. Registers the class with `window.jqhtml.register_component()`
5. Registers the template (happens automatically via IIFE)

### Component Class

**File: `test.js`**
```javascript
class Hello_Test extends Jqhtml_Component {
  async on_ready() {
    console.log('✅ Hello World from JS class on_ready()!');
    console.log(`Component name: ${this.component_name()}`);
    console.log(`Component CID: ${this._cid}`);
  }
}
```

The class:
- Extends `Jqhtml_Component` (base class for all components)
- Implements `on_ready()` lifecycle hook
- Logs to console to prove execution

### Template

**File: `test.jqhtml`**
```jqhtml
<Define:Hello_Test>
  <div class="hello-container">
    <p>Hello Test Component</p>
  </div>
</Define:Hello_Test>

<Hello_Test />
```

Simple template that renders the component.

## Running the Test

```bash
cd tests/js_class_support
./run-test.sh
```

## Expected Output

**Console logs:**
```
✅ Hello World from JS class on_ready()!
Component name: Hello_Test
Component CID: c1
```

**Rendered DOM:**
```html
<div class="Hello_Test Jqhtml_Component hello-container" data-cid="c1">
  <p>Hello Test Component</p>
</div>
```

## What This Proves

1. ✅ Test runner detects paired `.js` files
2. ✅ JS classes are inlined and registered before templates
3. ✅ Component class extends `Jqhtml_Component` correctly
4. ✅ Lifecycle methods (`on_ready()`) execute as expected
5. ✅ Template and class work together seamlessly

## Implementation Files

- **Test runner**: `/jqhtml-tester-10-23/test-runner.js`
  - Checks for paired `.js` files (same basename as `.jqhtml`)
  - Inlines JS code with `register_component()` call
- **Component registry**: `/packages/core/src/component-registry.ts`
  - `register_component(name, ComponentClass)` function
  - Links class to template by name

## Next Steps

This test enables more complex tests that require:
- Custom lifecycle behavior
- Component-specific state management
- Event handling
- Async data loading

See `lifecycle_bottom_up_timing/` test for a complex example.
