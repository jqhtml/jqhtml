# jQuery Plugin Getter/Setter Test

Validates `.component()` jQuery plugin syntax in both modes.

## What This Tests

1. **Setter mode** - `.component('Name', args)` returns jQuery object (enables chaining)
2. **Getter mode** - `.component()` returns component instance
3. **Chaining works** - Can call jQuery methods after setter
4. **Component lifecycle** - Full initialization completes

## Expected Output

```
========================================
JQUERY PLUGIN GETTER/SETTER TEST:
========================================

TEST 1: Setter mode (.component with args)
  Setter returned type: object
  Is jQuery object: true
  Has jQuery methods: true
  test-class added: true
✅ PASS: Setter returned jQuery object, chaining works

TEST 2: Getter mode (.component with no args)
  Getter returned type: object
  Is Jqhtml_Component: true
  Has .args property: true
  Has .data property: true
  Component args.user_id: 123
✅ PASS: Getter returned component instance with correct args

TEST 3: Component lifecycle
  Has _cid: true
  Has this.$: true
  Component ready: true
✅ PASS: Component lifecycle completed

========================================
✅ ALL TESTS PASSED
========================================
```

## Key Behaviors

- **Setter** (with arguments): Returns jQuery object for chaining
- **Getter** (no arguments): Returns component instance
- Component is fully initialized (has `_cid`, `this.$`, etc.)
- Args are passed correctly to component
