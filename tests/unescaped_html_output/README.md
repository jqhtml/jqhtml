# Unescaped HTML Output Test

## Purpose

Validates that `<%!= %>` syntax renders raw HTML while `<%= %>` escapes HTML entities.

This is a **critical security feature** - ensuring that:
- `<%= %>` (default) escapes HTML entities to prevent XSS attacks
- `<%!= %>` renders raw HTML for trusted content only

## What This Tests

1. **Escaped output**: `<%= "<strong>Bold</strong>" %>` should render as literal text (HTML entities escaped)
2. **Unescaped output**: `<%!= "<strong>Bold</strong>" %>` should render as actual HTML (`<strong>` element)
3. **XSS protection**: XSS attack strings are properly escaped by default

## Expected Behavior

### Escaped Output (Default - Safe)
- Input: `<strong>Bold Text</strong>`
- Rendered text: `<strong>Bold Text</strong>` (visible as literal text)
- DOM structure: Text node containing `&lt;strong&gt;Bold Text&lt;/strong&gt;`

### Unescaped Output (Raw HTML - Use with Caution)
- Input: `<strong>Bold Text</strong>`
- Rendered HTML: **Bold Text** (actual bold formatting)
- DOM structure: Actual `<strong>` element with text node inside

## Pass Criteria

✅ **Test passes if:**
1. Escaped div (`#escaped`) contains the literal text `<strong>Bold Text</strong>` (no HTML rendering)
2. Unescaped div (`#unescaped`) contains an actual `<strong>` HTML element
3. XSS test string is escaped and does not execute

❌ **Test fails if:**
- Escaped output renders HTML (security vulnerability!)
- Unescaped output doesn't render HTML
- XSS string executes (major security issue!)

## Related Documentation

- CLAUDE.md: Template Syntax Reference
- docs/official/01_template_syntax.md: String Interpolation section
