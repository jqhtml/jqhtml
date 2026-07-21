# content() Instruction Flattening Test

Validates that `content()` preserves component instruction structure (not converted to strings).

## What This Tests

1. **Component instances created** - Nested components in content become actual instances
2. **Structure preserved** - Components maintain their DOM structure
3. **Text content preserved** - Plain text mixed with components works
4. **Component hierarchy** - Nested components are children of wrapper

## Expected Output

```
========================================
content() INSTRUCTION FLATTENING TEST:
========================================

TEST 1: Component instances created
  Found .Inner components: 2
  Expected: 2
✅ PASS: Two Inner component instances created

TEST 2: Component structure preserved
  First Inner has <span class="inner">: true
  Correct text content: true
✅ PASS: Component structure preserved (not stringified)

TEST 3: Text content preserved
  Found <p> element: true
  Text: "Text content"
  Expected: "Text content"
✅ PASS: Text content preserved

TEST 4: Component hierarchy
  Inner components inside Wrapper: 2
  Expected: 2
✅ PASS: Component hierarchy preserved

========================================
✅ ALL TESTS PASSED
========================================
```

## Key Behaviors

- `content()` does NOT stringify components
- Nested component instructions flatten correctly
- Component instances are created for each component in content
- Text and components can be mixed in content
- DOM hierarchy matches component nesting
