# Define Tag $ Defaults Test

## Purpose

Validates that `$property=value` attributes on `<Define>` tags create default values for `this.args` that can be overridden by component invocations.

## What This Tests

### 1. Default Values Apply

When a component is defined with `$` defaults:

```jqhtml
<Define:Component_With_Defaults
    $per_page=25
    $sortable=true
    $endpoint="https://api.example.com/data"
    $theme="light">
  ...
</Define:Component_With_Defaults>
```

And invoked without providing those arguments:

```jqhtml
<Component_With_Defaults />
```

Then `this.args` should have the default values defined on the `<Define>` tag.

### 2. Invocation Overrides Defaults

When the component is invoked with explicit arguments:

```jqhtml
<Component_With_Defaults
  $per_page=50
  $sortable=false
  $theme="dark"
/>
```

The invocation values should override the Define defaults.

### 3. Partial Overrides Work

When only some arguments are provided at invocation:

```jqhtml
<Component_With_Defaults
  $per_page=100
  $theme="blue"
/>
```

- Provided args (`per_page`, `theme`) use invocation values
- Non-provided args (`sortable`, `endpoint`) use Define defaults

### 4. Quoted vs Unquoted Syntax Works

Default args respect the same quoted/unquoted distinction:

- `$per_page=25` → number 25
- `$sortable=true` → boolean true
- `$endpoint="https://api.example.com/data"` → string
- `$theme="light"` → string

## Expected Output

```
DEFINE TAG $ DEFAULTS TESTS:

Test 1: Default Values:
  per_page: ✅ PASS
    Expected: 25 (number)
    Actual: 25 (number)
  sortable: ✅ PASS
    Expected: true (boolean)
    Actual: true (boolean)
  endpoint: ✅ PASS
    Expected: "https://api.example.com/data" (string)
    Actual: "https://api.example.com/data" (string)
  theme: ✅ PASS
    Expected: "light" (string)
    Actual: "light" (string)

Test 2: Full Override:
  per_page: ✅ PASS
    Expected: 50 (number)
    Actual: 50 (number)
  sortable: ✅ PASS
    Expected: false (boolean)
    Actual: false (boolean)
  endpoint: ✅ PASS
    Expected: "https://override.com/api" (string)
    Actual: "https://override.com/api" (string)
  theme: ✅ PASS
    Expected: "dark" (string)
    Actual: "dark" (string)

Test 3: Partial Override:
  per_page: ✅ PASS
    Expected: 100 (number)
    Actual: 100 (number)
  sortable: ✅ PASS
    Expected: true (boolean)
    Actual: true (boolean)
  endpoint: ✅ PASS
    Expected: "https://api.example.com/data" (string)
    Actual: "https://api.example.com/data" (string)
  theme: ✅ PASS
    Expected: "blue" (string)
    Actual: "blue" (string)

✅ ALL DEFAULTS TESTS PASSED
```

## Use Case

This feature enables component configuration directly in the template without requiring a JavaScript class:

```jqhtml
<Define:Users_DataGrid
    extends="DataGrid_Abstract"
    $ajax_endpoint="https://api.example.com/users"
    $per_page=25
    $sortable=true
    class="card DataGrid">
  <#header>
    <th>ID</th>
    <th>Name</th>
  </#header>
</Define:Users_DataGrid>
```

Template-only component with sensible defaults that can be overridden when needed:

```jqhtml
<!-- Uses defaults -->
<Users_DataGrid />

<!-- Override per_page -->
<Users_DataGrid $per_page=50 />
```

## Documentation Reference

- CLAUDE.md: "Define Tag Configuration Attributes" section
- Official docs: Component definition syntax

## Files

- `test.jqhtml` - Main test entry point
- `component_with_defaults.jqhtml` - Component with $ defaults on Define tag
- `component_with_defaults.js` - Component class (logs args on ready)
- `test_container.jqhtml` - Test harness with 3 test scenarios
- `test_container.js` - Validation logic
- `run-test.sh` - Test runner script
