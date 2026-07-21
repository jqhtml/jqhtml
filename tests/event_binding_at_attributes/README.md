# Event Binding @ Attributes Test

## Purpose

Validates that `@click`, `@change`, `@submit`, and other `@event` attribute syntax correctly binds event handlers directly in templates.

This is a **critical feature** - the `@` attribute syntax provides declarative event binding in JQHTML templates.

## What This Tests

1. **@click binding**: `@click=this.method` binds click handlers
2. **@change binding**: Form input change events
3. **@submit binding**: Form submission events
4. **@focus/@blur binding**: Focus events
5. **@keyup/@keydown binding**: Keyboard events
6. **@mouseover/@mouseout binding**: Mouse events
7. **Multiple events on same element**: Both `@click` and `@mouseover`
8. **Event object access**: Handlers receive proper `event` parameter
9. **Component context**: `this` refers to component instance

## Expected Behavior

### Event Handler Binding
```jqhtml
<button @click=this.handle_click>Click Me</button>
```

**Compiles to:** Event listener attached during component initialization

**Runtime:**
- Click triggers `this.handle_click(event)`
- `event` is native DOM event object
- `this` is component instance

### Multiple Events
```jqhtml
<input @change=this.on_change @focus=this.on_focus />
```

Both event handlers bind to the same element.

### Event Object
Handlers receive standard DOM event with:
- `event.type` - Event type ("click", "change", etc.)
- `event.target` - Element that triggered event
- `event.preventDefault()` - Prevent default behavior
- `event.stopPropagation()` - Stop event bubbling

## Pass Criteria

✅ **Test passes if:**
1. Click events fire handlers correctly
2. Change events fire on input modification
3. Multiple events on same element both work
4. Event object passed to handlers with correct properties
5. `this` context is component instance (can access `this.$sid()`, etc.)
6. Event handlers can update DOM

❌ **Test fails if:**
- Events don't fire
- `this` context is wrong (window, element, etc.)
- Event object missing or incorrect
- Handlers throw errors
- Multiple events interfere with each other

## Related Documentation

- CLAUDE.md: Template Syntax - @ Attributes (Event Binding)
- docs/official/01_template_syntax.md: @ Attributes section
