# Control Flow Brace-Style Test

## Purpose

Validates that brace-style control flow (`if { }`, `for { }`) works correctly after removing colon-style syntax support (`:`, `endif;`, `endfor;`).

## What This Tests

1. **Simple if statement** - Conditional rendering based on `this.data.show_message`
2. **If-else statement** - Branching logic based on `this.data.is_admin`
3. **For loop** - Iterating over `this.data.items` array
4. **Nested if/for** - Complex nested control flow with both conditionals and loops

## Expected Behavior

### Test 1: Simple If
```jqhtml
<% if (this.data.show_message) { %>
  <p>Message is visible!</p>
<% } %>
```
Should render the paragraph when `show_message = true`.

### Test 2: If-Else
```jqhtml
<% if (this.data.is_admin) { %>
  <p>Admin user</p>
<% } else { %>
  <p>Regular user</p>
<% } %>
```
Should show "Regular user" when `is_admin = false`.

### Test 3: For Loop
```jqhtml
<% for (let item of this.data.items) { %>
  <li><%= item.name %></li>
<% } %>
```
Should render a list item for each item in the array.

### Test 4: Nested If/For
```jqhtml
<% if (this.data.items.length > 0) { %>
  <h3>Items Found</h3>
  <% for (let i = 0; i < this.data.items.length; i++) { %>
    <div>Item <%= i + 1 %>: <%= this.data.items[i].name %></div>
  <% } %>
<% } else { %>
  <p>No items found</p>
<% } %>
```
Should show heading and numbered items when array has elements.

## Implementation Notes

- Uses standard JavaScript brace syntax `{ }`
- All control flow uses ONLY brace-style (no colon-style)
- Validates parser changes to remove colon-style support
- Tests both basic and complex nesting scenarios

## Related Files

- **Parser**: `packages/parser/src/lexer.ts`, `packages/parser/src/parser.ts`, `packages/parser/src/codegen.ts`
- **Documentation**: `CLAUDE.md`, `docs/official/01_template_syntax.md`

## Running the Test

```bash
cd tests/control_flow_brace_style
./run-test.sh
```

## Success Criteria

✅ All four test sections render correctly
✅ Console shows "Control Flow Test component ready!"
✅ DOM contains expected content based on test data
✅ No parser or compilation errors
