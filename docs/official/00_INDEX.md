# JQHTML Documentation Research - October 7, 2025

## Overview

This directory contains comprehensive research documentation for JQHTML, a jQuery-based component templating system designed for simplicity and direct DOM manipulation.

## What is JQHTML?

JQHTML is a component system built on jQuery that rejects the complexity of modern frameworks. It provides:

- **Component-based architecture** without virtual DOM overhead
- **Template compilation** to efficient JavaScript
- **Deterministic lifecycle** (create → render → on_render → load → ready)
- **Direct jQuery integration** - components ARE jQuery objects
- **Simple syntax** - Easy to learn, easy to maintain

### Core Philosophy

Where React says "UI is a function of state," JQHTML says "UI is the state." The DOM is already an efficient rendering engine. jQuery already provides proven DOM manipulation. JQHTML adds just enough structure to build maintainable component-based applications without pretending the DOM doesn't exist.

## Documentation Files

### 01. Template Syntax ⭐ UPDATED (Nov 2025)
**File**: `01_template_syntax.md`

Comprehensive guide to JQHTML template language:
- Component definition with `<Define:Name>`
- String interpolation `<%= expression %>` (escaped)
- Unescaped output `<%!= expression %>` (raw HTML)
- Control flow `<% code %>` (loops, conditionals)
- Both colon `:` and brace `{}` styles
- Template comments `<%-- comment --%>`
- Expression evaluation
- **NEW**: Conditional attributes (PHTML-style)
- **NEW**: @ event binding syntax
- **NEW**: Define tag configuration (extends, defineArgs)

**Key Topics**:
- Basic component structure
- Escaped vs unescaped output (security critical)
- For loops and iteration
- If/else conditionals
- Complex expressions
- XSS protection via default escaping
- Conditional attributes in attribute lists
- Event binding with @ prefix
- Template inheritance via extends attribute
- Default arguments via defineArgs

### 02. Component Definition and Registration ⭐ UPDATED (Nov 2025)
**File**: `02_component_definition.md`

How components are defined, registered, and discovered:
- Template auto-registration (via IIFE)
- Class manual registration (required)
- Component class structure
- Lifecycle methods
- Data access patterns
- Naming conventions
- **NEW**: Template inheritance (three mechanisms)
- **NEW**: Default arguments (defineArgs)

**Key Topics**:
- `this.args` - Input parameters (read-only)
- `this.data` - Dynamically loaded data
- `this.$` - jQuery element reference
- `this.$sid()` - Scoped ID lookup
- State management via DOM manipulation
- Component discovery and instantiation
- JavaScript class inheritance
- extends attribute for template inheritance
- Slot-based inheritance (automatic)
- defineArgs for default $ attribute values

### 03. $ Attribute System and Scoped IDs ⭐ UPDATED (Nov 2025)
**File**: `03_dollar_attribute_system.md`

The `$` prefix system for special attributes:
- `$sid` for component-scoped IDs
- `$attribute` for data attributes
- Passing arguments to components
- **UPDATED**: Event binding uses @ prefix (not $onclick)

**Key Topics**:
- Quoted vs unquoted attribute values
- Scoped ID generation and access
- Data attribute mapping
- Complex expression syntax
- Accessing via `this.$sid()` and `.data()`
- @ event binding syntax reference

### 05. Component Nesting and content()
**File**: `05_component_nesting_and_content.md`

How components nest and pass content:
- Using `content()` to render passed content
- Nesting components arbitrarily deep
- Accessing child components
- Server-rendered content via `_inner_html`

**Key Topics**:
- Basic nesting patterns
- `content()` function usage
- Instruction flattening
- Parent-child communication
- Component tree traversal

### 06. Slot System (Named Content Areas)
**File**: `06_slot_system.md`

Advanced feature for multiple content placement:
- Named slots with `<Slot:slotname>` syntax
- Default vs named slots
- Common use cases (data tables, dialogs)

**Key Topics**:
- When to use slots vs simple `content()`
- Slot definition and usage
- All-or-nothing rule
- Data table patterns

### 07. RSpade Integration — Internal / Not in Public Release
**File**: `07_rspade_integration.md`

> **Internal only.** This chapter documents JQHTML's integration with RSpade, an internal
> Laravel-based framework. It is held back from the public documentation release and is
> not part of the public docs set.

### 08. jQuery Integration
**File**: `08_jquery_integration.md`

Components as genuine jQuery objects:
- `this.$` is real jQuery
- All jQuery methods available
- `.component()` method
- Overriding `.val()` for custom inputs

**Key Topics**:
- jQuery method access
- Scoped ID lookup with `this.$sid()`
- Event handling
- jQuery plugin integration
- Custom `.val()` implementation
- Direct DOM manipulation philosophy

### 09. Debugging Tools
**File**: `09_debugging_tools.md`

Comprehensive debugging capabilities:
- Debug overlay system
- Verbose logging
- Component inspection
- Performance profiling

**Key Topics**:
- `jqhtml.showDebugOverlay()`
- `window.jqhtml.debug.verbose = true`
- Component tree inspection
- Lifecycle debugging patterns
- Browser DevTools integration
- RSpade `rsx:debug` command

### 10. Clarifications: Attribute Precedence
**File**: `10_clarifications_attribute_precedence.md`

Q&A format clarifications on attribute handling:
- Tag attribute behavior (Define vs invocation)
- Class merging rules (no precedence, all merged)
- Attribute precedence (invocation overrides Define)
- $ vs data-* vs plain attributes
- @ event binding
- Undefined component behavior

### 11. Comprehensive Attribute Handling ⭐ UPDATED (Nov 2025)
**File**: `11_attribute_handling_comprehensive.md`

Complete reference for all attribute types:
- Plain HTML attributes
- data-* attributes
- $ attributes (component parameters)
- @ attributes (event binding)
- class attribute (special merging)
- tag attribute (element type)
- **NEW**: Conditional attributes (PHTML-style)
- Quoted vs unquoted $ values
- Precedence rules and decision table

### 12. Incremental Scaffolding
**File**: `12_incremental_scaffolding.md`

Using undefined components for progressive development:
- How undefined components work
- Default template and class behavior
- Development workflow patterns
- Team collaboration benefits
- Semantic HTML first approach
- When to define vs keep undefined

### 13. Scoped IDs and Element Access ⭐ UPDATED (Nov 2025)
**File**: `13_scoped_ids_and_element_access.md`

**Core topic**: `this.$sid()` is the preferred way to access template elements.

Complete guide to element access within components:
- Why scoped IDs prevent conflicts
- `$sid` attribute → `id="name:component_id"` format
- **NEW**: Component IDs are deterministic (based on DOM position)
- `this.$sid('name')` returns jQuery object
- Accessing both elements and components
- `this.$.find()` for descendant elements
- `this.$.closest()` for ancestor navigation
- `this.$.siblings()` for sibling access
- Practical examples (galleries, forms, radio groups)
- Performance considerations and caching

**Key Topics**:
- Scoped ID format and automatic generation
- Deterministic CID generation
- Never construct full IDs manually
- jQuery traversal methods on `this.$`
- Accessing nested components via `.component()`
- Image galleries, dynamic forms, radio groups examples

### 14. Complete Lifecycle Specification ⭐ ESSENTIAL ⭐ UPDATED (Nov 2025)
**File**: `14_lifecycle_complete_specification.md`

**Critical update**: Full 5-stage lifecycle with double-render pattern explained, render/reload methods updated.

Comprehensive lifecycle documentation:
- **5 stages**: create → render → on_render → load → ready (CORRECTED ORDER)
- **render() method**: Now includes full lifecycle (_render → _wait_for_children_ready → on_ready → trigger('ready'))
- **reload() method**: Smart cache integration - hydrates from cache if args changed, always revalidates via on_load()
- **Double-render pattern**: Why and when components render twice
- **on_render() timing**: Prevents visual glitches before children ready
- **on_ready() guarantee**: All children fully initialized
- **Automatic re-render**: After on_load() if this.data changes
- **Depth-ordered parallelization**: Siblings parallel, levels sequential
- **render(), reload(), stop()**: Lifecycle manipulation methods
- **Synchronous requirements**: on_create(), on_render(), on_stop() must be synchronous
- **Future caching feature**: Why conventions matter
- **Parent-child coordination**: Form example with child event hooks

**Key Topics**:
- **CORRECTED**: create runs BEFORE first render (not after)
- this.data starts as {} - check with Object.keys().length
- on_create() must be synchronous (convention)
- on_load() NO DOM modifications (critical)
- on_render() for immediate post-render initialization
- on_ready() waits for all children
- Double-render: first with {}, second after data loads
- render() = async, includes full lifecycle
- redraw() is now an alias for render()
- Developer notes on untested features

## Key Concepts Summary

### 1. Components ARE jQuery Objects
- `this.$` is a real jQuery reference
- All jQuery methods work directly
- No wrappers or abstractions

### 2. Deterministic Lifecycle
- create → render (top-down) → on_render (top-down) → load (parallel) → ready (bottom-up)
- Predictable initialization order
- Parent-child coordination guaranteed

### 3. The DOM IS the State
- No separate state management system
- Update the DOM directly: `this.$sid('status').text('Online')`
- State lives in DOM or component properties

### 4. Path-Agnostic Architecture
- Components referenced by name, not path
- Move files freely without breaking references
- Templates auto-register on import; classes require manual registration

### 5. $ Attribute System
- `$sid` = component-scoped IDs
- `$attribute` = data attributes
- Passes arguments to component as `this.args`

### 6. Simple content() for Most Cases
- 95% of components use simple `content()`
- Slots only for complex multi-area layouts
- All-or-nothing rule when using slots

### 7. No Backwards Compatibility (Pre-1.0)
- Breaking changes expected during beta
- Clean codebase without legacy burden
- v2 will always be v2.x.x
- This policy changes at 1.0 release (see ROADMAP.md)

### 8. jQuery-First Philosophy
- Built on proven technology
- No virtual DOM complexity
- Direct, honest DOM manipulation

## Implementation Checklist

When implementing JQHTML components:

1. ✅ Define template with `<Define:Name>`
2. ✅ Create JavaScript class extending `Jqhtml_Component`
3. ✅ Use `$sid` for component-scoped elements
4. ✅ Load data in `on_load()` (NO DOM manipulation)
5. ✅ Attach events and manipulate DOM in `on_ready()`
6. ✅ Include in bundle for compilation
7. ✅ Use `this.$` for jQuery access
8. ✅ Access children via `this.$sid().component()`

## Common Patterns

### Basic Component
```jqhtml
<Define:UserCard>
  <div class="card">
    <h3 $sid="title"><%= this.data.name %></h3>
  </div>
</Define:UserCard>
```

```javascript
class UserCard extends Jqhtml_Component {
  async on_load() {
    this.data = await fetch(`/api/users/${this.args.user_id}`)
      .then(r => r.json());
  }

  on_ready() {
    this.$sid('title').on('click', () => {
      console.log('Clicked:', this.data.name);
    });
  }
}
```

### Nested Components
```jqhtml
<Define:UserList>
  <div>
    <% for (let user of this.data.users) { %>
      <UserCard $user_id=user.id />
    <% } %>
  </div>
</Define:UserList>
```

### Using in Blade (RSpade)
```blade
<UserCard $user_id="123" />
```

## Design Principles

1. **KISS** - Keep It Simple, Stupid
2. **Talk is cheap, show me the code** - Working code over theory
3. **The DOM is sufficient** - No virtual DOM needed
4. **jQuery is proven** - 17 years of production use
5. **Fail loud** - No silent fallbacks
6. **Static-first** - Classes for namespacing, not OOP for OOP's sake
7. **Anti-React** - Complete rejection of circular state patterns
8. **Deterministic** - Predictable component initialization

## Why JQHTML Exists

Modern frameworks have convinced developers that updating a div to show "6" instead of "5" requires:
1. A state management system
2. A reconciliation algorithm
3. A virtual DOM diff
4. A commit phase
5. Effect handlers

JQHTML's revolutionary insight: `$('#count').text('6')` was sufficient all along.

## Next Steps

This research documentation captures all major features and patterns of JQHTML. The next phase is to:

1. Review for completeness and accuracy
2. Organize into proper online documentation
3. Add interactive examples
4. Create quick-start guides
5. Build API reference
6. Add migration guides

## Critical Additions from Test Component Analysis

### New Documentation Topics (Files 10-12)

**10_clarifications_attribute_precedence.md**:
- Q&A format capturing nuanced attribute behaviors
- Tag attribute as element type setter (not HTML attribute)
- Class merging from multiple sources
- $ vs data-* vs plain attributes explained
- @ event binding syntax
- Undefined component behavior

**11_attribute_handling_comprehensive.md**:
- Complete attribute type reference
- Quoted vs unquoted $ attribute values (critical difference)
- Precedence rules and decision tables
- Event binding with @ prefix
- Class merging rules in detail
- Practical examples for each attribute type

**12_incremental_scaffolding.md**:
- Using undefined components for progressive development
- Semantic HTML first approach
- Team collaboration workflows
- When to define vs keep undefined
- Complete blog application example

### Key Insights from Test Components

1. **$ attributes are function parameters**: Think of `<Component $sid=123>` as calling `Component({id: 123})`

2. **Quoted vs unquoted critical**:
   - `$data="variable"` → string literal "variable"
   - `$data=variable` → actual value of variable

3. **Class names accumulate**: Define classes + invocation classes + component name + parent classes all merged

4. **tag is not an attribute**: Sets DOM element type (`<span>`, `<div>`, etc.), never appears in rendered HTML

5. **Undefined components enable scaffolding**: Write semantic HTML immediately, implement behavior incrementally

6. **Component names auto-added to class**: Enables jQuery selection (`.UserCard`) and CSS targeting

### Attribute Type Summary

| Type | Syntax | Purpose | Access |
|------|--------|---------|--------|
| **$** | `$user_id=123` | Component parameters | `this.args.user_id` |
| **@** | `@click=this.handler` | Event binding | Automatic |
| **data-*** | `data-sid="123"` | Data attributes | `this.$.data('id')` |
| **Plain** | `style="..."` | HTML attributes | Standard DOM |
| **class** | `class="btn"` | CSS classes (merged) | `this.$.hasClass()` |
| **tag** | `tag="span"` | Element type | N/A (not rendered) |

### 15. Deduplication and Caching
**File**: `15_deduplication_and_caching.md`

> **Note:** This file shares the number 15 with `15_semantic_first_design_philosophy.md`
> immediately below — both files exist on disk under this number and are listed here
> under their actual filenames pending a renumbering pass.

Automatic request deduplication and transparent stale-while-revalidate caching for
component data loading:
- Component design requirements (state in `this.args`, data loading in `on_load()`)
- Request deduplication via INVOCATION_KEY (component name + serialized args)
- Transparent localStorage caching, opt-in via `jqhtml.set_cache_key()`
- `cache_id()` override for custom cache keys

**Key Topics**:
- Leader/follower deduplication of simultaneous identical `on_load()` calls
- Cache hit → instant render → background revalidation via `on_load()`
- Interaction with `reload()`'s smart cache integration

### 15. Semantic-First Design Philosophy
**File**: `15_semantic_first_design_philosophy.md`

Why JQHTML exists and the problems it solves:
- Reducing cognitive load for mechanical thinkers
- Semantic names vs cryptic CSS classes
- Traditional Bootstrap vs JQHTML comparison
- Development workflow examples
- Building readable, maintainable interfaces

**Key Topics**:
- Composing concepts, not elements
- Mental mapping overhead elimination
- Progressive development patterns
- Consistency through semantic naming

### 16. Bootstrap Component Library — Internal / Not in Public Release
**File**: `16_bootstrap_component_library.md`

> **Internal only.** This chapter catalogs reusable components extracted from real
> internal pages, illustrating semantic component patterns. It is held back from the
> public documentation release and is not part of the public docs set.

### 17. Semantic Iterative Design Methodology ⭐ ESSENTIAL
**File**: `17_semantic_iterative_design_methodology.md`

**The missing manual** on how and why to use semantic components:
- The core problem JQHTML solves
- Mechanical vs visual thinking
- When something becomes a component
- Cognitive load reduction strategies
- Iterative refinement process
- Component granularity guidelines
- Building a component library organically
- Team collaboration benefits
- Implementation strategy
- Common pitfalls to avoid
- Philosophical alignment

**Key Topics**:
- The boilerplate workflow example
- Component decision matrix
- Naming conventions that scale
- Consistency through reuse
- From creator's own perspective
- Real-world conversion examples
- Long-term vision for semantic UI

### 18. Boot - Server-Rendered Component Initialization ⭐ NEW
**File**: `18_boot.md`

How to initialize jqhtml components from server-rendered HTML placeholders:
- The `jqhtml.boot()` API
- Placeholder element contract (`_Component_Init` class)
- Passing arguments via `data-component-args`
- Passing content (slots) via innerHTML
- Nested component handling
- Server-side implementation examples (PHP, Laravel, Rails, Django, Node.js)
- Client-side setup with and without build tools
- Dynamic content initialization
- Debugging and common issues

**Key Topics**:
- Framework-agnostic server integration
- NOT Server-Side Rendering (SSR) - server outputs placeholders, client renders templates
- `await jqhtml.boot()` waits for entire component tree
- `jqhtml:ready` event for completion notification
- Helper functions for different server frameworks

### 19. SCSS Styling Conventions
**File**: `19_scss_styling_conventions.md`

Recommended (not enforced) SCSS organization patterns for JQHTML projects:
- One SCSS file per component, one wrapper class per file
- The wrapper class pattern (wrapper class matches the component name)
- Why this works: components automatically render with their component name as a CSS class

**Key Topics**:
- Automatic scoping via the component-name wrapper class
- Avoiding class name collisions between components
- Conventions vs framework-enforced behavior

### 20. Runtime Configuration
**File**: `20_runtime_configuration.md`

Integration-level settings the host application supplies when jqhtml loads, via
`jqhtml.init($, config)` or `jqhtml.configure(config)`:
- `mode: 'development' | 'production'` — defaults to development; production is opt-in
- `warn_uncacheable_args` — warn when a data-fetching component has non-serializable args and no `cache_id()`
- `debug_attributes` — emit `data-sid` (a debug mirror of the scoped `id`); off in production

**Key Topics**:
- How this differs from `jqhtml.debug` (environment vs interactive tracing)
- Per-flag overrides on top of a mode
- Why suppressing `data-sid`/`data-cid` is safe, and the one transient `data-cid` that must never be
- Adding a new convention

## Additional References

### LLM Reference
**File**: `LLM_REFERENCE_OFFICIAL_07_26.md`

A condensed, drop-in reference document intended to be pasted into an LLM's context
window (or referenced by an AI coding agent) when working on a project that uses
JQHTML. Summarizes components, template syntax, lifecycle, attributes, and common
patterns in a compact form distinct from the full chapter-by-chapter documentation
above.

## Sample Components

### SampleDatagridComponent
**Files**: `/rsx/theme/components/SampleDatagridComponent.jqhtml` and `.js`

Full-featured data table demonstrating:
- Loops to generate rows without repetition
- Column headers from configuration
- Selectable rows with checkboxes
- Status badges
- Action buttons (view, edit, delete)
- Pagination controls
- Loading states with Bootstrap placeholders
- Empty states
- Sample data generation

**Usage**:
```blade
<SampleDatagridComponent
  $title="Client List"
  $entity_name="clients"
  $selectable=true
  $pagination=true
  $allow_delete=true
  $view_url="/clients/{id}"
  $edit_url="/clients/{id}/edit"
  $columns=columns_array
/>
```

**Key Techniques**:
- Using `<% for %>` loops to avoid repetition
- Conditional rendering with `<% if %>`
- Loading state detection via `Object.keys(this.data).length === 0`
- Bootstrap placeholder animation for loading rows
- Dynamic badge colors from data
- URL template strings for actions

## Notes

- All documentation based on JQHTML v2
- Syntax and features validated against source code and test components
- Examples tested against RSpade integration
- Test components analyzed: test_component_1, 2, 3, loop_component_none
- Philosophy aligned with core JQHTML principles
- Research date: October 7, 2025
- Updated with attribute handling, scaffolding patterns, and semantic design methodology
- Template syntax updated with unescaped output (`<%!= %>`) documentation
