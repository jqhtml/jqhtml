# Template Extends JS Class Inheritance Test

Tests that child components with `extends=""` attribute automatically inherit JavaScript class behavior from parent templates when no child JS class is defined.

## What This Tests

1. **Template Inheritance**: Child template uses `extends="Parent"` for markup inheritance
2. **JS Class Resolution**: Child component with NO .js file automatically uses parent's JS class
3. **Lifecycle Execution**: Parent class lifecycle methods execute for child component instances
4. **Data Loading**: Parent class `on_load()` populates data for child component
5. **Method Availability**: Parent class methods are available on child component instances

## Test Structure

- **DataGrid_Abstract**: Base component with template + JS class (simulates Ajax data loading)
  - Has `on_create()` initializing data structure
  - Has `on_load()` simulating async data fetch
  - Has `on_ready()` logging completion
- **Contacts_DataGrid**: Child component that extends DataGrid_Abstract
  - Template uses `extends="DataGrid_Abstract"`
  - Defines custom slots for table header and rows
  - **NO .js file** - should automatically use DataGrid_Abstract class
- **Tester**: Renders Contacts_DataGrid and validates behavior

## Expected Behavior

1. Tester renders Contacts_DataGrid component
2. Framework finds no Contacts_DataGrid.js class
3. Framework checks Contacts_DataGrid template, sees `extends="DataGrid_Abstract"`
4. Framework walks extends chain, finds DataGrid_Abstract has registered JS class
5. Framework uses DataGrid_Abstract class for Contacts_DataGrid instance
6. DataGrid_Abstract `on_create()` fires, initializes data
7. DataGrid_Abstract `on_load()` fires, simulates data loading
8. Contacts_DataGrid renders with data from parent class
9. DataGrid_Abstract `on_ready()` fires

## Success Criteria

- Contacts_DataGrid uses DataGrid_Abstract JS class (no error about missing class)
- `on_create()` executed (data.rows initialized)
- `on_load()` executed (data.loaded = true)
- `on_ready()` executed (logged completion)
- Template renders with parent template structure and child slots
- Data from parent class available in child template

## Real-World Use Case

This pattern enables developers to:
- Create abstract base components with shared logic (DataGrid_Abstract, Form_Abstract, etc.)
- Define child components that are **template-only** variations
- Avoid boilerplate empty JS classes: `class Contacts_DataGrid extends DataGrid_Abstract {}`
- Keep logic DRY while allowing template customization
