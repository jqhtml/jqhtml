# Test: Conditional Attributes

## Purpose

Validates that conditional attributes using `<% if (condition) { %>attr="value"<% } %>` syntax compile correctly and generate proper runtime attribute merging code.

## The Problem (Solved in v2.2.162)

Programmers frequently attempted to use conditional logic for HTML attributes:

```jqhtml
<input <% if (this.args.min !== undefined) { %>min="<%= this.args.min %>"<% } %> />
```

This pattern failed to compile because the parser didn't recognize conditional blocks in attribute context.

### Previous Workarounds

Before this feature, developers had to use:

1. **Separate render paths:**
```jqhtml
<% if (this.args.required) { %>
  <input type="text" required="required" />
<% } else { %>
  <input type="text" />
<% } %>
```

2. **JavaScript string manipulation:**
```jqhtml
<input type="text" <%= this.args.required ? 'required="required"' : '' %> />
```

Both approaches were verbose and error-prone.

## The Solution

**New syntax:** `<% if (condition) { %>attribute="value"<% } %>`

This compiles to runtime attribute merging using `Object.assign()` with ternary operators.

### Compilation Examples

**Single conditional:**
```jqhtml
<input class="form-control" <% if (this.args.required) { %>required="required"<% } %> />
```

Compiles to:
```javascript
{tag: ["input", Object.assign({},
  {"class": "form-control"},
  ((this.args.required)) ? {"required": "required"} : {}
), true]}
```

**Multiple conditionals:**
```jqhtml
<input
  class="form-control"
  <% if (this.args.required) { %>required="required"<% } %>
  <% if (this.args.disabled) { %>disabled="disabled"<% } %> />
```

Compiles to:
```javascript
{tag: ["input", Object.assign({},
  Object.assign({},
    {"class": "form-control"},
    ((this.args.required)) ? {"required": "required"} : {}
  ),
  ((this.args.disabled)) ? {"disabled": "disabled"} : {}
), true]}
```

## What This Test Validates

1. **Static values** - `required="required"`
2. **Interpolated values** - `min="<%= this.args.min %>"`
3. **Composite strings** - `class="status <%= this.args.status %> active"`
4. **Multiple conditionals** - Several conditionals on same element
5. **Whitespace flexibility** - `if(cond){}`, `if( cond ){}`, `if (cond) {}`
6. **Mixed attributes** - Regular and conditional attributes together
7. **Component attributes** - Conditional `$` attributes on components
8. **Complex conditions** - `this.args.value && this.args.value.length > 0`

## Expected Behavior

All conditional attributes should:
- Compile without errors
- Generate `Object.assign()` with ternary operators
- Preserve attribute values (static, interpolated, or composite)
- Work alongside regular attributes
- Support multiple conditionals on single element

## Running the Test

```bash
cd tests/conditional_attributes
./run-test.sh
```

## Implementation Details

### AST Changes

**File:** `/packages/parser/src/ast.ts`

Added `ConditionalAttributeNode` interface:
```typescript
export interface ConditionalAttributeNode extends BaseNode {
  type: NodeType.CONDITIONAL_ATTRIBUTE;
  condition: string;  // JavaScript condition expression
  attributes: Record<string, any>;  // Attributes to include if condition is true
}
```

Extended `HtmlTagNode` and `ComponentInvocationNode` with:
```typescript
conditionalAttributes?: ConditionalAttributeNode[];
```

### Lexer Changes

**File:** `/packages/parser/src/lexer.ts`
**Function:** `scan_attributes()`
**Lines:** ~1207-1225

Modified to recognize `<%` tokens in attribute context and continue scanning attributes after `%>` closes:

```typescript
// Check for <% (conditional attribute start)
if (char === '<' && this.peek_ahead(1) === '%') {
  const start = this.position;
  this.advance(); // <
  this.advance(); // %
  this.add_token(TokenType.CODE_START, '<%', start, this.position);
  this.scan_code_block();

  // Consume the %> that scan_code_block left behind
  if (this.current_char() === '%' && this.peek_ahead(1) === '>') {
    const tag_end_start = this.position;
    this.advance(); // %
    this.advance(); // >
    this.add_token(TokenType.TAG_END, '%>', tag_end_start, this.position);
  }

  // Continue scanning attributes - DO NOT return
  continue;
}
```

### Parser Changes

**File:** `/packages/parser/src/parser.ts`
**Function:** `parse_attributes()`
**Lines:** ~1002-1021

Detects `CODE_START` tokens and calls `parse_conditional_attribute()`. Includes check to prevent parsing closing braces `<% } %>` as new conditionals:

```typescript
if (this.check(TokenType.CODE_START)) {
  // Check if this is a closing brace <% } %> - if so, stop parsing attributes
  const peek_next = this.tokens[this.current + 1];
  if (peek_next && peek_next.type === TokenType.JAVASCRIPT && peek_next.value.trim() === '}') {
    break;  // This is a closing brace, return control to caller
  }

  const condAttr = this.parse_conditional_attribute();
  if (condAttr) {
    conditionalAttributes.push(condAttr);
  }
  continue;
}
```

**Function:** `parse_conditional_attribute()`
**Lines:** ~1058-1140

Parses conditional attribute syntax:
1. Consumes `CODE_START` (`<%`)
2. Handles both brace style (`if (cond) {`) and colon style (`if (cond):`)
3. Extracts condition from JavaScript token
4. Recursively calls `parse_attributes()` for inner attributes
5. Validates no nested conditionals
6. Consumes closing `<% } %>`

### Codegen Changes

**File:** `/packages/parser/src/codegen.ts`
**Function:** `generate_attributes_with_conditionals()`
**Lines:** ~505-525

Generates runtime attribute merging code:

```typescript
private generate_attributes_with_conditionals(
  attrs: Record<string, any>,
  conditionalAttrs?: ConditionalAttributeNode[]
): string {
  // If no conditional attributes, use simple object
  if (!conditionalAttrs || conditionalAttrs.length === 0) {
    return this.generate_attributes_object(attrs);
  }

  // Start with base attributes
  let result = this.generate_attributes_object(attrs);

  // Add each conditional attribute as Object.assign()
  for (const condAttr of conditionalAttrs) {
    const condAttrsObj = this.generate_attributes_object(condAttr.attributes);
    result = `Object.assign({}, ${result}, (${condAttr.condition}) ? ${condAttrsObj} : {})`;
  }

  return result;
}
```

Updated 6 locations to use `generate_attributes_with_conditionals()` instead of `generate_attributes_object()`:
- Line ~521: HTML tags
- Line ~645: Component invocations
- Lines ~1051, 1087, 1105, 1133: Other tag contexts

## Supported Patterns

### Static Values
```jqhtml
<% if (this.args.required) { %>required="required"<% } %>
```

### Interpolated Values
```jqhtml
<% if (this.args.min !== undefined) { %>min="<%= this.args.min %>"<% } %>
```

### Composite Strings
```jqhtml
<% if (this.args.active) { %>class="status <%= this.args.status %> active"<% } %>
```

### Multiple Conditionals
```jqhtml
<input
  <% if (this.args.required) { %>required="required"<% } %>
  <% if (this.args.disabled) { %>disabled="disabled"<% } %>
  <% if (this.args.readonly) { %>readonly="readonly"<% } %> />
```

### Whitespace Variations
All these are valid:
- `<% if (condition) { %>`
- `<% if(condition){ %>`
- `<% if( condition ){ %>`
- `<%if(condition){%>`

### Complex Conditions
```jqhtml
<% if (this.args.value && this.args.value.length > 0) { %>value="<%= this.args.value %>"<% } %>
```

## Limitations

### No Nested Conditionals
```jqhtml
<!-- NOT ALLOWED -->
<% if (outer) { %>
  <% if (inner) { %>attr="value"<% } %>
<% } %>
```

Parser validates against this and throws error: "Nested conditional attributes are not supported"

### Only if Statements
```jqhtml
<!-- NOT ALLOWED -->
<% for (let x of items) { %>attr="value"<% } %>
```

Only `if` statements are recognized in attribute context.

### No else Clauses
```jqhtml
<!-- NOT ALLOWED -->
<% if (cond) { %>attr="yes"<% } else { %>attr="no"<% } %>
```

Use separate conditionals instead:
```jqhtml
<% if (cond) { %>attr="yes"<% } %>
<% if (!cond) { %>attr="no"<% } %>
```

## Related Files

- `/packages/parser/src/ast.ts` - AST node definitions
- `/packages/parser/src/lexer.ts` - Tokenization with attribute-mode handling
- `/packages/parser/src/parser.ts` - Recursive descent parsing
- `/packages/parser/src/codegen.ts` - JavaScript generation

## Regression Prevention

This test serves as a regression guard. If the implementation breaks:

1. **Test 1** - Basic conditional fails to compile
2. **Test 3** - Interpolation in conditionals breaks
3. **Test 4** - Composite strings fail
4. **Test 5** - Whitespace variations cause parse errors

The test immediately reveals any regression in conditional attribute handling.
