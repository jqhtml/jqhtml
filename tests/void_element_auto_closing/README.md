# Void Element Auto-Closing Test

## Purpose

Validates that HTML5 void elements automatically self-close without requiring explicit closing tags, while component elements still require explicit closing or self-closing syntax.

This ensures JQHTML follows **HTML5 standard void element behavior**.

## What This Tests

1. **Void elements auto-close**: `<input>`, `<img>`, `<br>`, `<hr>`, `<meta>`, `<link>` work without closing tags
2. **Components require closing**: `<User_Card>` requires `</User_Card>` or `<User_Card />`
3. **No parsing errors**: Void elements without closing tags compile successfully
4. **Proper rendering**: All void elements appear correctly in DOM

## Expected Behavior

### HTML5 Void Elements (Auto-Close)
These elements are **self-closing by HTML5 specification**:
- `<input>` - Form inputs
- `<img>` - Images
- `<br>` - Line breaks
- `<hr>` - Horizontal rules
- `<meta>` - Metadata
- `<link>` - Linked resources
- `<area>` - Image map areas
- `<base>` - Base URL
- `<col>` - Table columns
- `<embed>` - Embedded content
- `<source>` - Media sources
- `<track>` - Text tracks
- `<wbr>` - Word break opportunities

### Component Elements (Require Closing)
- `<User_Card />` - Self-closing syntax required
- `<User_Card></User_Card>` - Explicit closing required
- `<User_Card>` alone - **INVALID**, causes parser error

## Pass Criteria

✅ **Test passes if:**
1. All void elements render without errors
2. Void elements accessible via `this.$sid()`
3. No closing tags needed for void elements
4. Components still require proper closing syntax

❌ **Test fails if:**
- Parser errors on void elements without closing tags
- Void elements not rendered in DOM
- Void elements require closing tags

## Related Documentation

- CLAUDE.md: Template Syntax - Void Elements Auto-Close
- HTML5 Specification: Void elements
