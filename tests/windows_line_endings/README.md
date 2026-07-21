# Windows Line Endings Test

## What This Tests

Validates that JQHTML templates render correctly when files have Windows line endings (`\r\n` / CRLF) instead of Unix line endings (`\n` / LF).

## The Bug

**Symptom:** Template text content disappeared when files had Windows line endings.

**Example:**
```jqhtml
<Define:Inner_Component tag="main">
  Hello world!
</Define:Inner_Component>
```

With Windows line endings, this would compile to an empty render function and produce:
```html
<main class="Inner_Component"></main>
```

Instead of:
```html
<main class="Inner_Component">  Hello world! </main>
```

## Root Cause

The lexer was not normalizing line endings before tokenization. When it encountered `\r\n`, the `\r` characters were being handled inconsistently, causing text content to be lost during compilation.

## The Fix

Added line ending normalization in the lexer constructor (lexer.ts:91-94):

```typescript
constructor(input: string) {
  // Normalize all line endings to \n (handles \r\n and \r)
  let processed = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // ... rest of preprocessing
}
```

Now all line endings are converted to `\n` before any tokenization happens, ensuring consistent behavior across platforms.

## Test Structure

- **outer.jqhtml** - Container component that dynamically creates inner component
- **outer.js** - Creates Inner_Component in on_ready()
- **inner.jqhtml** - Simple template with text content (converted to CRLF)
- **inner.js** - Empty component class
- **run-test.sh** - Converts inner.jqhtml to CRLF if needed, then runs test

## Running the Test

```bash
./run-test.sh
```

The test automatically converts `inner.jqhtml` to Windows line endings if it doesn't already have them, then validates that "Hello world!" appears in the rendered output.

## Why This Matters

1. **Windows users** - Many developers use Windows and their editors may save files with CRLF
2. **Git autocrlf** - Git's `core.autocrlf=true` converts files to CRLF on Windows checkout
3. **Cross-platform robustness** - Templates should work regardless of line ending format
4. **Real-world usage** - Production code often mixes line endings across files

## Related Files

- `/var/www/html/jqhtml/packages/parser/src/lexer.ts` - Line ending normalization
