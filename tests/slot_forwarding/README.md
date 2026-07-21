# Slot Forwarding Test

## What This Tests

Validates that slots can be forwarded through multiple component layers by defining new slots that call parent's `content()` function.

## Pattern Being Tested

**3-level component hierarchy:**
1. `Component_A` - Defines the actual slot content
2. `Component_B` - Forwards slot to Component_C by wrapping it
3. `Component_C` - Renders the forwarded slot

**Key technique:**
```jqhtml
<Component_C>
    <#row>
        <%= content('row', row); %>
    </#row>
</Component_C>
```

Inside Component_B, we define a new `row` slot that calls the parent's `content('row', row)`.

## Test Cases

### Test 1: Basic Slot Forwarding
- Component_A defines slot with row rendering logic
- Component_B forwards slot to Component_C
- Component_C iterates and renders using forwarded slot
- **Expected:** Rows render with original slot content

### Test 2: Slot Parameter Passing
- Slot receives parameter (`row` object)
- Parameter is passed through forwarding chain
- **Expected:** Data flows correctly through all layers

### Test 3: Multiple Slots Forwarding
- Forward multiple different slots simultaneously
- Each slot maintains its own context
- **Expected:** All slots render independently

## Real-World Use Case

**DataGrid pattern:**
```jqhtml
<DataGrid_Abstract>
    <#row>
        <td><%= row.id %></td>
        <td><%= row.name %></td>
    </#row>
</DataGrid_Abstract>
```

Internally, `DataGrid_Abstract` forwards the `row` slot to `DataGrid_Body`:
```jqhtml
<DataGrid_Body>
    <#row>
        <%= content('row', row); %>
    </#row>
</DataGrid_Body>
```

This allows separation of concerns:
- DataGrid_Abstract handles pagination, filtering
- DataGrid_Body handles table rendering
- Parent defines row template

## Implementation Details

**How it works:**
1. Parent's slot definition compiles to function: `slots.row = function(row) { return ...; }`
2. Middle component receives parent's `content()` function
3. Middle component defines new slot that calls `content('row', row)`
4. Child component receives the wrapped slot function
5. Child calls `content('row', data)` which executes the chain

**Scope management:**
- Slot parameter (`row`) is in scope within slot definition
- Parent's `content()` is accessible from middle component's scope
- Each layer maintains proper `this` binding

## Running the Test

```bash
./run-test.sh
```

Watch console for rendered output showing the slot forwarding chain working correctly.

## Related Files

- `/packages/parser/src/parser.ts` - Slot parsing
- `/packages/parser/src/codegen.ts` - Slot function generation
- `/packages/core/src/component.ts` - Slot rendering
