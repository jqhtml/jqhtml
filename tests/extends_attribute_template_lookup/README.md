# extends Attribute Template Lookup Test

Validates `extends="ParentName"` template inheritance without requiring JS class inheritance.

## What This Tests

1. **Template lookup by name** - Child finds parent template at runtime
2. **Parent structure rendered** - DataGrid_Base table structure appears
3. **Slots filled** - Child's slot definitions populate parent's content() calls
4. **No JS inheritance needed** - Template-only inheritance works

## Expected Output

```
========================================
extends ATTRIBUTE TEMPLATE LOOKUP TEST:
========================================

TEST 1: Parent template structure
  Has <table class="table">: true
  Has <thead>: true
  Has <tbody>: true
✅ PASS: Parent template structure rendered

TEST 2: Header slot content
  Header cells: 2
  First: "ID"
  Second: "Name"
✅ PASS: Header slot filled correctly

TEST 3: Row slot content
  Body rows: 2
  First row: ID="1", Name="Alice"
✅ PASS: Row slots filled correctly

========================================
✅ ALL TESTS PASSED
========================================
```

## Key Behaviors

- `extends="ParentName"` looks up parent template by name
- Parent template structure is used
- Child's slots fill parent's `content()` calls
- Works without JS class inheritance
