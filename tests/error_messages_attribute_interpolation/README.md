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
<Component $foo=JSON.stringify(data) />

<!-- $ attributes with string values (less preferred) -->
<Component $foo="<%= variable_name %>" />
```

## Invalid Patterns

```jqhtml
<!-- Attribute assigned to <%= %> block directly -->
<Component foo=<%= bar() %> />          ❌ Invalid
<Component $foo=<%= bar() %> />         ❌ Invalid

<!-- These should use quotes -->
<Component foo="<%= bar() %>" />        ✅ Valid
<Component $foo="<%= bar() %>" />       ✅ Valid (but prefer $foo=bar())
```

## Test Files

- `test_invalid.jqhtml` - Reproduces the user's error (`$options=<%= ...`)
- `test_valid.jqhtml` - Shows correct pattern (`$options="<%= ..."`)
- `run-test.sh` - Runs both tests

## Expected Behavior

**Invalid test** should fail with clear error message explaining:
- You cannot assign attributes directly to `<%= %>` blocks
- Put quotes around interpolation: `attr="<%= value %>"`
- Or use literal JavaScript for `$` attributes: `$attr=value`

**Valid test** should compile successfully.
