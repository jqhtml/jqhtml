# Debugging

When something isn't working, start here. JQHTML includes built-in tools for diagnosing component issues, tracking lifecycle execution, and profiling performance.

Everything on this page is an interactive switch you flip while chasing a specific problem.
That is different from [Production & Configuration](../18-production-configuration/), which
describes the environment your application runs in and is set once at startup. One consequence
worth knowing here: in production mode the `data-sid` and `data-cid` attributes are not
rendered, so a production DOM shows the scoped `id` but no debug mirrors. You can turn them
back on without leaving production mode.

## Quick Diagnostics

Before diving into code, run these commands in your browser console to understand the current state.

### What's Registered?

```javascript
jqhtml.list_components()
```

Returns all registered components with their status:

```javascript
{
  "UserCard": { has_class: true, has_template: true },
  "Dashboard": { has_class: true, has_template: false },
  "Alert": { has_class: false, has_template: true }
}
```

If a component shows `has_template: false`, the `.jqhtml` file wasn't compiled or imported. If `has_class: false`, there's no JavaScript class - the component uses the default `Jqhtml_Component`.

### Version Check

```javascript
jqhtml._version()
```

Output:

```
JQHTML Core v2.3.4
Registered Templates:
  - UserCard: v2.3.4
  - Dashboard: v2.3.2
  - Alert: unknown
```

Version mismatches between core and templates can cause subtle bugs. If a template shows "unknown", it was compiled with an older parser version.

### Check Specific Template

```javascript
jqhtml.get_template('UserCard')        // Returns template definition or default
jqhtml.get_registered_templates()       // Array of all template names
jqhtml.get_component_names()            // Array of all class names
```

## Debug Settings

### Presets

```javascript
jqhtml.enableDebugMode('basic')   // Recommended starting point
jqhtml.enableDebugMode('full')    // Everything enabled
jqhtml.clearDebugSettings()       // Reset to normal
```

### Manual Configuration

```javascript
jqhtml.setDebugSettings({
  // Logging
  logFullLifecycle: true,      // All lifecycle events
  logCreationReady: true,      // Just create/ready (less noise)

  // Visual
  flashComponents: true,       // Border flash on lifecycle events (requires logFullLifecycle or logCreationReady)
  flashDuration: 500,          // Flash duration in ms

  // Timing
  delayAfterComponent: 100,    // Pause after each component (ms)

  // Performance
  profilePerformance: true,    // Track render times
  highlightSlowRenders: 50     // Outline components taking >50ms
})
```

### Verbose Logging

`jqhtml.debug.verbose` is a separate switch from lifecycle logging. It logs internal cache, deduplication, and SSR preload operations - not lifecycle phases:

```javascript
jqhtml.debug.verbose = true
```

Output when caching and deduplication are active:

```
[Cache data] Component c123 (UserCard) checking cache in create()
[Load Deduplication] Component c123 (UserCard) is the leader
[Load Deduplication] Component c456 (UserCard) is a follower, waiting for leader
[Load Deduplication] Component c456 applied data from leader
```

### Lifecycle Logging

For per-phase lifecycle output, use `logFullLifecycle` or `logCreationReady` instead (also enabled by `enableDebugMode('full')` / `enableDebugMode('basic')`):

```javascript
jqhtml.setDebugSettings({ logFullLifecycle: true })
```

Output when a component initializes:

```
[JQHTML 2026-07-21T18:04:12.001Z] UserCard#c123 → create starting...
[JQHTML 2026-07-21T18:04:12.003Z] UserCard#c123 ✓ create complete
[JQHTML 2026-07-21T18:04:12.003Z] UserCard#c123 → load starting...
[JQHTML 2026-07-21T18:04:12.148Z] UserCard#c123 ✓ load complete
[JQHTML 2026-07-21T18:04:12.149Z] UserCard#c123 → ready starting...
[JQHTML 2026-07-21T18:04:12.154Z] UserCard#c123 ✓ ready complete
```

Add `profilePerformance: true` to also print a duration after each `complete` line, e.g. `✓ load complete (145ms)`.

## Component Inspection

### Access Component Instance

```javascript
// Select element in DevTools Elements panel, then:
$0.component()

// Or by selector:
$('#user-card').component()

// Inspect state
const comp = $('#user-card').component()
console.log(comp.args)      // Parameters passed via $ attributes
console.log(comp.data)      // Data loaded in on_load()
console.log(comp._cid)      // Component instance ID
```

### List All Components on Page

```javascript
$('.Component').each(function() {
  const comp = $(this).component()
  console.log(comp.constructor.name, comp._cid)
})
```

### Component Tree

```javascript
function debugTree(root = document.body) {
  $(root).find('.Component').each(function() {
    const comp = $(this).component()
    const depth = $(this).parents('.Component').length
    console.log('  '.repeat(depth) + comp.constructor.name)
  })
}

debugTree()
```

Output:

```
Dashboard
  Sidebar
    NavMenu
  MainPanel
    UserCard
    UserCard
```

## Lifecycle Debugging

Add logging to lifecycle methods to track execution:

```javascript
class UserCard extends Jqhtml_Component {
  on_create() {
    console.log('UserCard.on_create()', this.args)
  }

  async on_load() {
    console.log('UserCard.on_load() start')
    this.data = await fetch(`/api/users/${this.args.user_id}`).then(r => r.json())
    console.log('UserCard.on_load() end', this.data)
  }

  on_ready() {
    console.log('UserCard.on_ready()', {
      args: this.args,
      data: this.data
    })
  }
}
```

## Common Issues

### Component Not Initializing

```javascript
// 1. Check if registered
jqhtml.list_components()
// Look for your component - is it there?

// 2. Check template specifically
jqhtml.get_template('UserCard')
// If returns default template, your .jqhtml wasn't loaded

// 3. Check if element has Component class
$('#my-card').hasClass('Component')  // Should be true after init

// 4. Listen for ready event
$('#my-card').component().on('ready', () => console.log('Ready!'))
```

### Data Not Loading

```javascript
async on_load() {
  console.log('Loading user:', this.args.user_id)

  try {
    const response = await fetch(`/api/users/${this.args.user_id}`)
    console.log('Status:', response.status)
    this.data = await response.json()
    console.log('Data:', this.data)
  } catch (error) {
    console.error('Load failed:', error)
  }
}
```

### Scoped ID Not Found

```javascript
on_ready() {
  const element = this.$sid('title')

  if (element.length === 0) {
    console.error('Element with $sid="title" not found')
    // Find all scoped IDs belonging to this component (id ends with :_cid)
    const scopedIds = $(`[id$=":${this._cid}"]`).map(function() {
      return $(this).attr('id').split(':')[0]  // Extract the local ID part
    }).get()
    console.log('Available scoped IDs:', scopedIds)
  }
}
```

### Child Component Not Ready

```javascript
on_ready() {
  const child = this.sid('child')  // Get component by $sid

  if (!child) {
    console.error('Child component not found')
    console.log('Children count:', this.$.find('.Component').length)
    return
  }

  console.log('Child ready:', child.constructor.name)
}
```

## Browser DevTools

### Global Debug Helper

```javascript
window.debugComponent = function(selector) {
  const comp = $(selector).component()
  console.log('Component:', comp.constructor.name)
  console.table(comp.args)
  console.table(comp.data)
  return comp
}

// Usage: debugComponent('#user-card')
```

### Breakpoints

```javascript
on_ready() {
  debugger  // Pause here in DevTools

  this.$sid('button').on('click', () => {
    debugger  // Pause on click
    this.handle_click()
  })
}
```

## Quick Reference

| Tool | Purpose |
|------|---------|
| `jqhtml.list_components()` | See all registered components |
| `jqhtml._version()` | Check core and template versions |
| `jqhtml.enableDebugMode('basic')` | Enable standard logging |
| `jqhtml.setDebugSettings({...})` | Fine-grained debug config |
| `$('#id').component()` | Get component instance |
| `$('.Component')` | Find all components |
| `debugger` statement | Manual breakpoint |

## Getting Help

If you're stuck after trying these tools:

- **GitHub Issues:** [github.com/jqhtml/jqhtml/issues](https://github.com/jqhtml/jqhtml/issues) - Report bugs, ask questions, request features
- **JQHTML Website:** [jqhtml.org](https://jqhtml.org/) - Documentation and contact information

Every bug report and question helps improve JQHTML. Don't hesitate to reach out.

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/official/09_debugging_tools.md` - Complete debugging tools documentation
- `packages/core/src/debug.ts` - Debug function implementations
- `packages/core/src/component-registry.ts` - Registry functions (list_components, etc.)

### Last Updated
2026-08-19

### Editorial Notes
- 2026-08-19: Distinguished this chapter's interactive debug switches from runtime
  configuration (chapter 18), and noted that `data-sid`/`data-cid` are absent in production —
  the most likely surprise for someone inspecting a production DOM.
- **Major rewrite (2025-11-26):** Restructured for developers hitting problems
- Added Quick Diagnostics section with `list_components()`, `_version()` - previously undocumented
- Added `setDebugSettings()` and `enableDebugMode()` API documentation
- Fixed incorrect `jqhtml.templates['UserCard']` → `jqhtml.get_template('UserCard')`
- Added "Getting Help" section with GitHub and jqhtml.org links per user request
- Removed RSpade-specific tools (rsx:debug, console_debug) - not relevant to general users
- **Removed Debug Overlay (2025-11-26):** Previous implementation removed, fresh design planned (see TODO.md)
- **2026-07-21 accuracy pass:** Removed `breakOnError`, `sequentialProcessing`, and `traceDataFlow` from all examples and the Quick Reference table - these settings are read by dead code with no call sites in `packages/core/src` and currently have no effect. Split "Verbose Logging" into two sections: `jqhtml.debug.verbose` (gates cache/dedup/SSR logging only, corrected example output and log prefix) and a new "Lifecycle Logging" section documenting `logFullLifecycle`/`logCreationReady` (which produce the per-phase `→ starting...` / `✓ complete` output that was previously misattributed to `verbose`). Fixed GitHub Issues link to `github.com/jqhtml/jqhtml`. Fixed `JqhtmlComponent` references to `Jqhtml_Component`.
