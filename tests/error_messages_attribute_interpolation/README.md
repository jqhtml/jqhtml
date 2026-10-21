# Attribute Interpolation Error Messages Test

## Purpose

Tests error messages for common attribute interpolation mistakes.

## The Problem

Users often write:
```jqhtml
<Component $options=<%= JSON.stringify(data) %> />
```

This is invalid because unquoted `$` attributes expect a JavaScript variable/expression, not a `<%=` interpolation block.

## Valid Patterns

```jqhtml
<!-- Regular attributes with string values -->
<Component foo="bar" />
<Component foo="<%= get_value() %>" />

<!-- $ attributes with literal JavaScript -->
<Component $foo=variable_name />
<Component $foo=this.data.options />
<Component $foo=(JSON.stringify(data)) />

<!-- A bracketed $ value may span lines -->
<Component $options=(JSON.stringify([
  {value: 3, label: 'Member'},
])) />

<!-- $ attributes with string values (less preferred); one line only -->
<Component $foo="<%= variable_name %>" />
```

## Invalid Patterns

```jqhtml
<!-- Attribute assigned to <%= %> block directly -->
<Component foo=<%= bar() %> />          ❌ Invalid
<Component $foo=<%= bar() %> />         ❌ Invalid

<!-- A <%= %> expression in a quoted value spanning lines -->
<Component $foo="<%= bar(
  1) %>" />                             ❌ Invalid (use $foo=(bar(\n 1)))
```

## Test Files

- `test_invalid.jqhtml` - `$options=<%= ...` (unquoted): fails, and the error names
  `$options=(JSON.stringify(data))`
- `test_multiline_quoted.jqhtml` - `$options="<%= ...` spanning lines: fails with "must be
  on one line", and the error shows the bracketed form
- `test_valid.jqhtml` - the bracketed multi-line `$` value and one-line quoted
  interpolation compile
- `run-test.sh` - asserts all three (each error's text is checked)
