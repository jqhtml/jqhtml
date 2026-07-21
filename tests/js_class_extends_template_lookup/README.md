# JS Class Extends Template Lookup Test

Tests that when a JS class extends another JS class, and the parent class has a template but the child doesn't, instantiating the child class walks UP the prototype chain to find the parent's template.

## What This Tests

1. **JS Class Hierarchy**: Parent class (Form_Base) HAS template, child class (My_Form) has NO template
2. **Template Resolution**: Only parent has template, child has NO template
3. **Upward Template Lookup**: When child class instantiated, framework walks UP prototype chain to find parent's template
4. **Pure JS Inheritance**: Child class extends parent class in JavaScript

## Test Structure

- **Form_Base.js + Form_Base.jqhtml**: Base class with template
  - Has logic methods: `get_data()`, `validate()`
  - Has template with card layout
- **My_Form.js**: Extends Form_Base, NO template
  - Adds method: `format_output()`
  - No .jqhtml file
- **Tester**: Instantiates `My_Form`
  - Should use `Form_Base` template (walks up prototype chain)

## Expected Behavior

1. Tester invokes `<My_Form />`
2. My_Form class registered, but no My_Form template exists
3. Framework checks My_Form prototype chain: My_Form → Form_Base → Jqhtml_Component
4. Finds Form_Base HAS a template
5. Uses Form_Base template for My_Form instance
6. My_Form methods available on component

## Success Criteria

- My_Form component renders using Form_Base template
- My_Form methods work (format_output)
- Form_Base methods work (get_data, validate)
- Template content from Form_Base displays
- No errors about missing template

## Real-World Use Case

Concrete implementations without templates that inherit from abstract base classes:
- `Modal_Base` (has template) → `Confirmation_Modal` (no template, just logic)
- `Form_Base` (has template) → `Login_Form` (no template, just custom validation)
- Child classes can extend behavior without defining new templates
