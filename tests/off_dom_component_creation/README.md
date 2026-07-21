# Off-DOM Component Creation Test

Tests that components can be created detached from the DOM, complete their full lifecycle (including child component initialization), and then be attached to the DOM later.

## What This Tests

1. **Off-DOM Creation**: Components instantiated via `$('<div>').component('Name')` work correctly
2. **Child Component Initialization**: Child components boot and complete lifecycle while off-DOM
3. **$sid() Fallback**: Scoped ID lookups work using `find()` fallback when not in document
4. **Bottom-Up Lifecycle**: Children complete `on_ready()` before parent, even off-DOM
5. **Async Data Loading**: Simulates realistic async operations during `on_load()`
6. **DOM Attachment**: Components function correctly after being appended to DOM

## Test Structure

- **Base_Component**: Rendered in DOM initially, creates off-DOM component programmatically
- **Second_Component**: Created off-DOM, waits for children, modifies child text via `$sid()`
- **Third_Level_Child**: Nested component with simulated async load delay
- **Fourth_Level_Child**: Deepest component to test multi-level nesting

## Expected Behavior

1. Base_Component renders in DOM
2. Base_Component creates Second_Component off-DOM during `on_ready()`
3. Second_Component boots off-DOM, instantiates Third_Level_Child
4. Third_Level_Child boots, instantiates Fourth_Level_Child
5. Fourth_Level_Child completes async load (25ms delay)
6. Third_Level_Child's `on_ready()` fires after children ready
7. Second_Component's `on_ready()` fires, uses `$sid()` to modify Fourth_Level_Child text
8. After 100ms delay, Second_Component appended to Base_Component
9. Test validates Fourth_Level_Child has correct text set by Second_Component

## Success Criteria

- Fourth_Level_Child element contains text "Modified by Second_Component"
- Text was set while off-DOM (before attachment)
- All lifecycle hooks executed in correct order
- No errors during off-DOM operations
