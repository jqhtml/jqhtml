# Undefined Components Default Behavior Test

Validates JQHTML's incremental scaffolding philosophy: undefined components work immediately.

## What This Tests

1. **Render as divs** - Components without `.jqhtml` files render as `<div>` elements
2. **Component name class** - Component name automatically added to class attribute
3. **Framework marker** - `Jqhtml_Component` class added automatically
4. **Content preserved** - Inner content passes through correctly
5. **Hierarchy preserved** - Nesting structure maintained

## Expected Output

```
========================================
UNDEFINED COMPONENTS DEFAULT BEHAVIOR TEST:
========================================

TEST 1: Undefined components render as <div> elements
  Undefined_Header found: true
  Undefined_Header tag: DIV
  Undefined_Logo found: true
  Undefined_Logo tag: DIV
  Undefined_Nav found: true
  Undefined_Link count: 2
✅ PASS: All undefined components render as <div>

TEST 2: Component names added to class attribute
  Undefined_Header has class: true
  Undefined_Logo has class: true
  Undefined_Nav has class: true
  Undefined_Link has class: true
✅ PASS: All component names added as classes

TEST 3: Jqhtml_Component marker class added
  Undefined_Header has Jqhtml_Component: true
  Undefined_Logo has Jqhtml_Component: true
✅ PASS: Jqhtml_Component marker class added

TEST 4: Content passes through correctly
  First link text: "Home"
  Second link text: "About"
  Expected: "Home" and "About"
✅ PASS: Content preserved correctly

TEST 5: Component hierarchy preserved
  Logo inside Header: true
  Nav inside Header: true
  Links inside Nav: 2
✅ PASS: Component hierarchy preserved

========================================
✅ ALL TESTS PASSED
========================================
```

## Key Behaviors

- **Incremental scaffolding** - Use components before defining them
- **Default template** - Undefined components get `<%= content() %>` template
- **Default class** - Use base `Jqhtml_Component` when no JS class defined
- **Semantic classes** - Component names added to DOM for CSS targeting
- **No errors** - Framework handles undefined components gracefully
- **Build structure first** - Add definitions and styles later
