# Whitespace Preservation Test

This test demonstrates JQHTML's whitespace handling behavior between non-text elements.

## Purpose

Verify that whitespace in JQHTML templates is properly preserved or collapsed according to these rules:

1. **Whitespace between elements is preserved as a single space**
2. **Multiple whitespace characters (spaces, tabs, newlines) collapse to single space**
3. **Minified markup (no spaces) is respected**
4. **Leading/trailing spaces in text nodes are preserved**

## Whitespace Rules

### Rule 1: Preserve Intentional Spaces

```jqhtml
<span>A</span> <span>B</span>
```

**Renders as:** `<span>A</span> <span>B</span>` (space preserved)

### Rule 2: Collapse Whitespace Sequences

```jqhtml
<span>A</span>     <span>B</span>
```

**Renders as:** `<span>A</span> <span>B</span>` (multiple spaces → single space)

### Rule 3: Newlines Treated as Spaces

```jqhtml
<span>Line1</span>
<span>Line2</span>
```

**Renders as:** `<span>Line1</span> <span>Line2</span>` (newline → single space)

### Rule 4: Respect Minified Markup

```jqhtml
<span>A</span><span>B</span>
```

**Renders as:** `<span>A</span><span>B</span>` (no space added)

### Rule 5: Preserve Text Node Spaces

```jqhtml
<span> hello </span>
```

**Renders as:** `<span> hello </span>` (leading/trailing spaces kept)

## Test Cases

| ID | Test | Expected Output |
|----|------|----------------|
| test1 | `<%= "Jane" %> <%= "Smith" %>` | `Jane Smith` (space between) |
| test2 | `<span>Foo</span> <span>Bar</span>` | Space between spans |
| test3 | `<span>Foo</span><span>Bar</span>` | No space (minified) |
| test4 | `<span> hello </span>` | Leading/trailing spaces kept |
| test5 | `<span>A</span>     <span>B</span>` | Multiple spaces → single space |
| test6 | `<span>Line1</span>\n<span>Line2</span>` | Newline → space |
| test7 | `<%= "Hello" %> <strong>world</strong> <%= "!" %>` | Spaces preserved |
| test8 | `<div>Block1</div> <div>Block2</div>` | Space between divs |
| test9 | `Line1<br />Line2` | br tag preserved |
| test10 | Complex nesting with expressions | All spaces preserved correctly |

## Implementation Details

### Lexer (lexer.ts)
- Preserves original text content including newlines
- No whitespace collapsing at lexer level
- Maintains source positions for accurate sourcemaps

### Codegen (codegen.ts)
- Collapses whitespace sequences to single space during code generation
- Whitespace-only text nodes → single space output
- Text with content → internal whitespace collapsed

### Why This Approach?

1. **Sourcemaps work correctly** - original positions preserved in lexer
2. **Developer-friendly** - what you write is what you get (with sensible collapsing)
3. **Tag-agnostic** - no assumptions about block vs inline (CSS can change display)
4. **Predictable** - simple rules, consistent behavior

## Running the Test

```bash
cd /var/www/html/jqhtml/jqhtml-render-harness
node test-runner.js ../tests/whitespace-preservation/test.jqhtml
```

Expected: All test cases render with proper whitespace handling.
