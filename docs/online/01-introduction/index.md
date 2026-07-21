# Introduction

JQHTML is a component templating system built on jQuery. It lets you compose logical concepts in HTML rather than assembling visual primitives with cryptic class names.

## What JQHTML Is

JQHTML provides:

- **Component-based architecture** without virtual DOM
- **Template compilation** to efficient JavaScript
- **Deterministic lifecycle** (create → render → load → ready)
- **Direct jQuery integration** - components ARE jQuery objects

Where React says "UI is a function of state," JQHTML says "UI is the state." The DOM is already an efficient rendering engine. jQuery already provides proven DOM manipulation. JQHTML adds structure for maintainable component-based applications without pretending the DOM doesn't exist.

## The Problem JQHTML Solves

Traditional HTML development looks like this:

```html
<div class="container-fluid">
  <div class="row">
    <div class="col-md-8">
      <div class="card">
        <div class="card-body">
          <h5 class="card-title">User Profile</h5>
          <p class="card-text">...</p>
        </div>
      </div>
    </div>
  </div>
</div>
```

Problems with this approach:

- Cryptic class names (`container-fluid`, `col-md-8`)
- Mental mapping burden - what does each class do?
- Unclear structure - is this a page section? a card? a layout?
- Hard to maintain consistency across a project

## The JQHTML Way

Write markup using semantic component names:

```jqhtml
<Page>
  <ContentArea>
    <UserProfile>
      <UserCard $user_id="123" />
    </UserProfile>
  </ContentArea>
</Page>
```

Benefits:

- **Readable** - intent is immediately clear
- **Logical** - components named for what they ARE, not how they look
- **No mental mapping** - `UserCard` means exactly what it says
- **Composable** - nest concepts naturally
- **Reusable** - same components across entire project

## How It Works

A JQHTML component can be:

- Just a `.jqhtml` template file
- Just a `.js` class file
- Both template and JS files
- Neither (undefined components render as `<div>` with the component name as class)

**Template file** (`user_card.jqhtml`):

```jqhtml
<Define:UserCard class="card">
  <h3><%= this.data.name %></h3>
  <p><%= this.data.email %></p>
</Define:UserCard>
```

**JavaScript file** (`user_card.js`) - only if behavior is needed:

```javascript
class UserCard extends Jqhtml_Component {
  async on_load() {
    this.data = await fetch(`/api/users/${this.args.user_id}`)
      .then(r => r.json());
  }
}
```

**Usage** (in a template):

```jqhtml
<UserCard $user_id="123" />
```

The component fetches its data, renders the template, and becomes a live jQuery object you can manipulate.

## Core Principles

### DOM Is the State

No separate state management system. Update the DOM directly:

```javascript
this.$sid('status').text('Online');
this.$sid('counter').text(count + 1);
```

### Components Are jQuery

`this.$` is a real jQuery object. All jQuery methods work:

```javascript
this.$.addClass('active');
this.$.fadeIn(300);
this.$.find('.item').each(...);
```

### Semantic First

Name components for what they represent, not how they look:

- `<UserCard>` not `<div class="card">`
- `<InvoiceStatusBadge>` not `<span class="badge badge-success">`
- `<DashboardHeader>` not `<div class="d-flex justify-content-between">`

### Incremental Scaffolding

Undefined components work immediately. Write your page structure first:

```jqhtml
<Dashboard>
  <StatsPanel />
  <ActivityFeed />
  <QuickActions />
</Dashboard>
```

This renders as nested divs with component names as classes. Define templates when ready - the structure works from the start.

## When to Use JQHTML

JQHTML is designed for developers who:

- Think mechanically rather than visually
- Want component structure without framework complexity
- Prefer direct DOM manipulation over state abstractions
- Value jQuery's proven API
- Need predictable, deterministic component initialization

## Next Steps

Continue to [Getting Started](../02-getting-started/) to set up your first JQHTML project.

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/official/00_INDEX.md` - Overview and philosophy
- `docs/official/15_semantic_first_design_philosophy.md` - Core philosophy and examples

### Last Updated
2026-07-21

### Editorial Notes
- Focused on "what" and "why" rather than "how" - details belong in later chapters
- Used the traditional HTML vs JQHTML comparison as the core illustration
- Deliberately kept brief - this is a doorway, not a manual
- Omitted: lifecycle details, attribute system specifics, slot system - these have dedicated chapters
- Included the "component can be template, JS, both, or neither" concept per user request
- Bootstrap classes mentioned only to illustrate the problem; noted JQHTML is CSS-agnostic
- Accuracy pass: fixed base class name to `Jqhtml_Component` (no export named `JqhtmlComponent` exists)
