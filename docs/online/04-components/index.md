# Components

JQHTML components combine templates and JavaScript classes to create reusable UI elements. This chapter covers component structure, organization, and how components work.

## Component Structure

A component can consist of:

| Configuration | Description |
|---------------|-------------|
| Template only | Visual structure, no custom behavior |
| JavaScript only | Behavior with default template |
| Both | Full component with structure and behavior |
| Neither | Undefined component (renders as div) |

### Template-Only Component

For components that just render markup:

```jqhtml
<Define:StatusBadge class="badge">
  <span class="badge-<%= this.args.type %>">
    <%= this.args.label %>
  </span>
</Define:StatusBadge>
```

### JavaScript-Only Component

For components that need behavior but use default template:

```javascript
class AutoRefresh extends Jqhtml_Component {
  on_ready() {
    setInterval(() => this.refresh(), 30000);
  }

  async refresh() {
    await this.reload();
  }
}
```

The default template is `<%= content() %>` - content passes through wrapped in a div.

### Full Component

Most components have both template and class:

**Template** (`user_card.jqhtml`):

```jqhtml
<Define:UserCard class="card">
  <img $sid="avatar" src="<%= this.data.avatar_url %>" />
  <h3 $sid="name"><%= this.data.name %></h3>
  <button $sid="follow">Follow</button>
</Define:UserCard>
```

**JavaScript** (`user_card.js`):

```javascript
class UserCard extends Jqhtml_Component {
  async on_load() {
    this.data = await fetch(`/api/users/${this.args.user_id}`)
      .then(r => r.json());
  }

  on_ready() {
    this.$sid('follow').on('click', () => this.follow_user());
  }

  async follow_user() {
    await fetch(`/api/users/${this.args.user_id}/follow`, { method: 'POST' });
    this.$sid('follow').text('Following');
  }
}
```

## Naming Conventions

### Requirements

1. **Component names must start with a capital letter** - This is how the parser distinguishes `<UserCard>` (component) from `<div>` (HTML element)
2. **JS class name must match template name exactly** - `UserCard` class pairs with `<Define:UserCard>`

### Recommended Convention

`PascalCase` is the standard JavaScript convention:

```
UserCard
ProductListItem
DashboardStatsPanel
```

Any naming style works as long as the first letter is capitalized and names match.

### File Names

File naming is up to you. Common conventions:

```
UserCard.jqhtml       // PascalCase (React style)
user-card.jqhtml      // kebab-case (Vue style)
userCard.jqhtml       // camelCase
```

### Directory Structure

Organize by feature or type:

```
components/
├── user/
│   ├── UserCard.jqhtml
│   ├── UserCard.js
│   └── UserAvatar.jqhtml
├── dashboard/
│   ├── StatsPanel.jqhtml
│   └── ActivityFeed.jqhtml
└── shared/
    ├── StatusBadge.jqhtml
    └── LoadingSpinner.jqhtml
```

## Automatic Classes

Every component receives two automatic CSS classes:

1. **Component name** - `UserCard`, `StatusBadge`
2. **`Component`** - Framework marker

```html
<!-- <UserCard class="shadow" /> renders as: -->
<div class="UserCard Component shadow">
  ...
</div>
```

This enables CSS targeting by component name:

```css
.UserCard {
  border-radius: 8px;
  padding: 1rem;
}

.UserCard .name {
  font-weight: bold;
}
```

## Undefined Components

Components work before they're defined. Use any component name:

```jqhtml
<Dashboard>
  <StatsGrid>
    <RevenueCard />
    <OrdersCard />
  </StatsGrid>
</Dashboard>
```

Renders immediately as nested divs:

```html
<div class="Dashboard Component">
  <div class="StatsGrid Component">
    <div class="RevenueCard Component"></div>
    <div class="OrdersCard Component"></div>
  </div>
</div>
```

Define templates and classes when needed. The structure works from day one.

## Using Components

### Within Templates (Child Components)

Once a component is running, its template can invoke other components:

```jqhtml
<Define:UserList>
  <% for (let user of this.data.users) { %>
    <UserCard $user_id=user.id />
  <% } %>
</Define:UserList>
```

### Programmatically (Top-Level)

The base library invokes top-level components via jQuery:

```javascript
// Create component on existing element
$('#container').component('UserCard', { user_id: 123 });

// Create new element with component
$('<div>')
  .component('UserCard', { user_id: 123 })
  .appendTo('#container');

// Get component instance
const card = $('#my-card').component();
console.log(card.data.name);
```

This is the only way to invoke a top-level component with the core library.

### Framework Integration

Framework-specific integrations may enable component syntax directly in server templates (e.g. Blade). No such integration is available yet - this is a work in progress, not a package you can install today. Until it ships, use the programmatic `$().component()` API above to invoke top-level components from server-rendered pages.

## Component Properties

Every component instance has:

| Property | Description |
|----------|-------------|
| `this.$` | jQuery reference to root element |
| `this.args` | Arguments passed via `$` attributes |
| `this.data` | Data loaded in `on_load()` |
| `this._cid` | Unique component instance ID |
| `this.$sid(id)` | Access scoped elements |
| `this.sid(id)` | Access child component instances |

## Multiple Instances

Each component instance is independent:

```jqhtml
<UserCard $user_id="1" />
<UserCard $user_id="2" />
<UserCard $user_id="3" />
```

Each instance:
- Has its own `this.args` and `this.data`
- Maintains its own state
- Fetches its own data
- Responds to its own events

## Element Type

Components render as `<div>` by default. Change with `tag`:

**At definition** (permanent):

```jqhtml
<Define:NavLink tag="a" class="nav-link">
  <%= content() %>
</Define:NavLink>
```

**At invocation** (override):

```jqhtml
<UserCard tag="article" $user_id="123" />
```

Common element types:

| Element | Use Case |
|---------|----------|
| `div` | Default, block containers |
| `span` | Inline elements |
| `a` | Links |
| `button` | Clickable elements |
| `article` | Content sections |
| `nav` | Navigation |
| `form` | Form containers |
| `li` | List items |

## Component Registration

Both templates and classes require explicit registration.

### Registration Methods

| Method | Purpose |
|--------|---------|
| `jqhtml.register(source)` | Unified - auto-detects templates or classes |
| `jqhtml.register_template(template)` | Register a compiled template |
| `jqhtml.register_component(name, class)` | Register a class with explicit name |

### Template Registration

Import and register compiled templates explicitly:

```javascript
import jqhtml from '@jqhtml/core';
import UserCardTemplate from './components/UserCard.jqhtml';

jqhtml.register_template(UserCardTemplate);
// or: jqhtml.register(UserCardTemplate);
```

### Class Registration

JavaScript classes must be registered with their component name:

```javascript
import jqhtml from '@jqhtml/core';
import { UserCard } from './components/UserCard.js';

jqhtml.register_component('UserCard', UserCard);
```

The first argument must match the component name in the template.

### Using Unified register() for Classes

`register()` works with a class out of the box, using the class's own name:

```javascript
class UserCard extends Jqhtml_Component {
  // ...
}

jqhtml.register(UserCard);  // Registers as "UserCard" using the class name
```

Add a static `component_name` property only if the class name can't be trusted at runtime (for example, after JS minification mangles class names). When present, it takes priority over the class name:

```javascript
class UserCard extends Jqhtml_Component {
  static component_name = 'UserCard';  // Survives minification
  // ...
}

jqhtml.register(UserCard);
```

### Framework Integrations

Some framework integrations (like [RSpade](https://rspade.org)) may handle registration automatically. Consult your framework integration's documentation for details.

## Finding Components

Find all component instances:

```javascript
$('.Component').each(function() {
  const component = $(this).component();
  console.log(component.constructor.name);
});
```

Find specific component type:

```javascript
$('.UserCard').each(function() {
  const card = $(this).component();
  console.log(card.data.name);
});
```

Check if element is a component:

```javascript
if ($element.hasClass('Component')) {
  const component = $element.component();
}
```

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/official/02_component_definition.md` - Component structure and registration
- `docs/official/12_incremental_scaffolding.md` - Undefined components

### Last Updated
2025-11-25

### Editorial Notes
- Focused on "what is a component" rather than lifecycle or parameters (separate chapters)
- Emphasized the four possible file configurations early
- Naming conventions important for team consistency
- Undefined components concept reinforced from Getting Started
- Registration section clarifies templates auto-register, classes require manual registration
- Linked to RSpade for framework integrations that may auto-register
- Omitted inheritance (separate chapter)
- Kept programmatic creation brief - covered more in jQuery chapter
- Accuracy pass: fixed base class name to `Jqhtml_Component` (no export named
  `JqhtmlComponent` exists); removed the claim of an installable `jqhtml-laravel`
  composer package (Blade component syntax is still work-in-progress, not shipped)
