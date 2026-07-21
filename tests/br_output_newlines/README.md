# BR Output Test (<%br= %> syntax)

## Purpose

Tests the `<%br= %>` interpolation syntax that:
1. HTML-escapes the output (like `<%= %>`)
2. Converts newline characters (`\n`) to `<br />` tags

## Use Case

User-entered text often contains newlines that should display as line breaks in HTML. The `<%br= %>` syntax handles this common need:

```jqhtml
<Define:Comment_Display>
  <div class="comment">
    <%br= this.data.comment_text %>
  </div>
</Define:Comment_Display>
```

Without `<%br= %>`, you'd need to either:
- Use `<%!= %>` with manual escaping (error-prone)
- Post-process the output with JavaScript

## Syntax Comparison

| Syntax | HTML Escaped | Newline to BR |
|--------|--------------|---------------|
| `<%= %>` | Yes | No |
| `<%!= %>` | No | No |
| `<%br= %>` | Yes | Yes |

## Test Cases

1. **Standard Escaped (`<%= %>`)**: Verifies newlines stay as literal characters
2. **BR Output (`<%br= %>`)**: Verifies newlines become `<br />` tags
3. **BR with HTML**: Verifies HTML is escaped but BR conversion still works
4. **Unescaped (`<%!= %>`)**: Comparison to show no BR conversion

## Expected Results

- Test 1: No `<br />` tags in output
- Test 2: 2 `<br />` tags for 2 newlines in "Line 1\nLine 2\nLine 3"
- Test 3: Escaped `&lt;strong&gt;` AND `<br />` tags present
- Test 4: No `<br />` tags (raw output)

## Related Source Files

- `packages/parser/src/lexer.ts` - `EXPRESSION_BR` token
- `packages/parser/src/parser.ts` - `nl2br` property on ExpressionNode
- `packages/parser/src/codegen.ts` - `escape_html_nl2br()` call generation
- `packages/core/src/template-renderer.ts` - `escape_html_nl2br()` function
