# Raw Content Tags Test

## Purpose

Validates that `<textarea>` and `<pre>` tags preserve exact whitespace without any collapsing, trimming, or normalization.

## What This Tests

### Core Behavior

**Normal HTML tags** use `padded_trim()`:
- Collapse internal whitespace (multiple spaces → single space)
- Preserve leading/trailing space if present
- Newlines become spaces

**Raw content tags** (textarea, pre) preserve everything:
- All spaces and tabs remain exactly as written
- Newlines stay as newlines
- No collapsing, no trimming
- HTML entities properly escaped

### Test Cases

| Test | Validates |
|------|-----------|
| 1. Textarea with Code | Indentation preserved in JavaScript code block |
| 2. Pre with ASCII Art | Exact spacing for visual alignment |
| 3. Leading/Trailing Newlines | Empty lines before/after content |
| 4. Mixed Spaces/Tabs | Both whitespace types preserved |
| 5. HTML Entities | `<`, `>`, `&` escaped but formatting unchanged |
| 6. Multi-line Code | Blank lines and indentation in code |
| 7. Empty Tags | Truly empty (no phantom whitespace) |
| 8. Nested Structure | Works within complex DOM trees |
| 9. Attributes | `class`, `disabled`, `placeholder`, etc. work |
| 10. Whitespace-Only | Preserves spaces/newlines without content |

## Implementation

### Parser (parser.ts)

Detects textarea/pre tags and sets `preserveWhitespace: true` flag on HtmlTagNode:

```typescript
const tag_lower = tag_name.toLowerCase();
const preserveWhitespace = tag_lower === 'textarea' || tag_lower === 'pre';
```

### Codegen (codegen.ts)

Generates `rawtag` instruction instead of normal `tag` instruction:

```typescript
if (node.preserveWhitespace && !node.selfClosing && node.children.length > 0) {
  // Collect raw content WITHOUT padded_trim
  let rawContent = '';
  for (const child of node.children) {
    if (child.type === NodeType.TEXT) {
      rawContent += (child as TextNode).content;
    }
  }

  // Escape for JavaScript string literal
  const escapedContent = this.escape_string(rawContent);

  return `_output.push({rawtag: ["${node.name}", ${attrs_obj}, ${escapedContent}]});`;
}
```

### Instruction Processor (instruction-processor.ts)

Handles `rawtag` instruction with HTML entity escaping:

```typescript
function process_rawtag_to_html(
  instruction: RawTagInstruction,
  html: string[]
): void {
  const [tagName, attrs, rawContent] = instruction.rawtag;

  // Build opening tag with attributes
  html.push(`<${tagName}`);
  for (const [key, value] of Object.entries(attrs)) {
    // ... attribute handling
  }
  html.push('>');

  // Escape HTML entities but preserve whitespace
  const escaped_content = rawContent
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html.push(escaped_content);
  html.push(`</${tagName}>`);
}
```

## Running the Test

```bash
cd tests/raw-content-tags
./run-test.sh
```

**Output shows:**
- Rendered DOM structure
- Console logs with content verification
- Character counts and line counts
- Raw content samples for visual inspection

## Expected Behavior

### Example: Code in Textarea

**Template:**
```jqhtml
<textarea>function hello() {
    console.log("Hello");
}</textarea>
```

**Compiled instruction:**
```javascript
_output.push({
  rawtag: [
    "textarea",
    {},
    "function hello() {\n    console.log(\"Hello\");\n}"
  ]
});
```

**Rendered HTML:**
```html
<textarea>function hello() {
    console.log("Hello");
}</textarea>
```

**Browser textContent:** Exact match including all newlines and spaces.

### Example: ASCII Art in Pre

**Template:**
```jqhtml
<pre>   _____
  /     \
 | () () |</pre>
```

**Result:** Exact spacing preserved, visual alignment intact.

## Related Files

- AST definition: `/packages/parser/src/ast.ts` (HtmlTagNode.preserveWhitespace)
- Parser logic: `/packages/parser/src/parser.ts` (textarea/pre detection)
- Code generation: `/packages/parser/src/codegen.ts` (rawtag instruction)
- Runtime handler: `/packages/core/src/instruction-processor.ts` (process_rawtag_to_html)

## Why This Matters

**Use cases requiring exact whitespace:**
- Code editors and syntax highlighting
- ASCII art and diagrams
- Pre-formatted text displays
- Form textareas with default content
- Poetry and formatted text

Without this feature, indentation would collapse and content would be malformed.
