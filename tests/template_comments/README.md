# Template Comments Test

## Purpose

Validates that `<%-- comment --%>` syntax is properly removed from compiled output and does not appear in the rendered DOM.

This is a **critical template feature** - ensuring that:
- Template comments are completely stripped during compilation
- Comments do not appear in compiled JavaScript code
- Comments do not appear in rendered DOM
- Multi-line comments work correctly

## What This Tests

1. **Single-line comments**: `<%-- This is a comment --%>` should be removed
2. **Multi-line comments**: Comments spanning multiple lines should be removed
3. **Comments with special characters**: Ensure edge cases are handled
4. **No artifacts in DOM**: Comment text should not appear anywhere in final output

## Expected Behavior

### Template Comments (Removed)
- Input: `<%-- This is a comment --%>`
- Compiled code: No trace of comment
- DOM: No trace of comment

### Visible Content (Preserved)
- Input: `<p>Visible content</p>`
- Compiled code: Contains rendering instructions
- DOM: Renders as normal HTML

## Pass Criteria

✅ **Test passes if:**
1. DOM contains only visible content elements
2. Comment text does not appear in DOM
3. Comment text does not appear in compiled JavaScript output
4. Multi-line comments are completely removed

❌ **Test fails if:**
- Comment text appears in DOM (even as text node)
- Comment text appears in compiled code
- Parsing errors occur
- Multi-line comments not fully removed

## Related Documentation

- CLAUDE.md: Template Syntax Reference
- docs/official/01_template_syntax.md: Interpolation section
