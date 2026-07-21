# on_render() Timing and Purpose Test

## Purpose

Validates that `on_render()` fires immediately after DOM update, BEFORE children boot. Primary use case: hiding uninitialized UI to prevent visual glitches.

## What This Tests

### 1. on_render() Fires Before Children Boot

Parent's `on_render()` should execute before child components initialize:

```javascript
class Parent extends Jqhtml_Component {
  on_render() {
    console.log('Parent on_render');  // Fires FIRST
    this.$.css('opacity', '0');       // Hide before children render
  }
}

class Child extends Jqhtml_Component {
  on_ready() {
    console.log('Child on_ready');    // Fires SECOND
  }
}
```

**Expected order:** Parent on_render → Child on_ready

### 2. on_render() Fires Before on_ready()

Component's own `on_render()` executes before its `on_ready()`:

```javascript
on_render() {
  console.log('on_render');  // FIRST
}

on_ready() {
  console.log('on_ready');   // SECOND (after children ready)
}
```

### 3. Use Case: Hiding Uninitialized UI

Prevent visual glitches by hiding components until fully initialized:

```javascript
on_render() {
  // Hide immediately after DOM creation
  this.$.css('opacity', '0');
  this.$sid('status').text('Loading...');
}

async on_ready() {
  // Show after children fully loaded
  this.$.animate({opacity: 1}, 300);
  this.$sid('status').text('Ready!');
}
```

## Expected Output

```
Parent on_render (timestamp1)
Child on_load: Starting slow load...
Child on_load: Load complete
Child on_ready (timestamp2)
Parent on_ready (timestamp3)

LIFECYCLE ORDER VALIDATION:

1. Parent on_render (timestamp1)
2. Child on_ready (timestamp2)
3. Parent on_ready (timestamp3)

Expected order:
1. Parent on_render (first)
2. Child on_ready (after parent renders)
3. Parent on_ready (after child ready)

✅ PASS: Lifecycle order correct
   - on_render() fires BEFORE children boot
   - on_render() fires BEFORE on_ready()
   - Parent on_ready() fires AFTER child ready
```

## Why This Matters

**Prevents visual glitches:**
- UI elements appear fully initialized (no flash of unstyled content)
- Loading states show immediately
- Smooth transitions instead of jarring updates

**Common use cases:**
1. Hide components until children load
2. Show loading spinners immediately
3. Set initial CSS states before user interaction
4. Prevent layout shifts during initialization

## Implementation Details

**Lifecycle sequence:**
1. `create()` - Component instantiation
2. `_render()` - DOM creation, child instantiation
3. **`on_render()`** - BEFORE children boot
4. Children boot (in parallel)
5. Children `on_ready()` (bottom-up)
6. **`on_ready()`** - AFTER all children ready

**Timing guarantees:**
- `on_render()` has access to `this.$` (DOM exists)
- `on_render()` does NOT have access to child components yet
- `on_render()` MUST be synchronous (no async/await)

## Documentation Reference

- CLAUDE.md: "Component Lifecycle" section
- CLAUDE.md: "on_render() - Called IMMEDIATELY after DOM update"

## Files

- `test.jqhtml` - Main test entry point
- `parent_with_render.jqhtml` - Parent component template
- `parent_with_render.js` - Parent with on_render() validation
- `child_component.jqhtml` - Child component template
- `child_component.js` - Child with slow on_load()
- `run-test.sh` - Test runner script
