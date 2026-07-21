# Component Definition and Registration

## Overview

JQHTML components consist of templates (`.jqhtml` files) and optional JavaScript classes. Both templates and classes must be explicitly registered with the framework.

## Component Registration

JQHTML uses a registry to match component names to their templates and classes. Three registration methods are available.

### Registration Methods

| Method | Purpose |
|--------|---------|
| `jqhtml.register(source)` | Unified registration - auto-detects templates or classes |
| `jqhtml.register_template(template)` | Register a compiled template |
| `jqhtml.register_component(name, class)` | Register a JavaScript class with explicit name |

### Template Registration

Compiled templates export a template definition object. Import and register explicitly:

```javascript
// app.js - main entry point
import jqhtml from '@jqhtml/core';
import UserCardTemplate from './components/UserCard.jqhtml';

// Register template - two equivalent options:
jqhtml.register_template(UserCardTemplate);
// or
jqhtml.register(UserCardTemplate);
```

Compiled templates include the `__jqhtml_template: true` marker that enables auto-detection by `register()`.

### Class Registration

JavaScript classes must be registered with their component name:

```javascript
// components/UserCard.js
import { Jqhtml_Component } from '@jqhtml/core';

export class UserCard extends Jqhtml_Component {
  async on_load() {
    this.data = await fetch(`/api/users/${this.args.user_id}`)
      .then(r => r.json());
  }

  on_ready() {
    this.$sid('follow').on('click', () => this.follow_user());
  }
}
```

```javascript
// app.js - main entry point
import jqhtml from '@jqhtml/core';
import { UserCard } from './components/UserCard.js';

// Register the class with explicit name
jqhtml.register_component('UserCard', UserCard);
```

### Using Unified register() for Classes

The unified `register()` method works with a class out of the box - it uses the class's own name by default:

```javascript
// components/UserCard.js
export class UserCard extends Jqhtml_Component {
  async on_load() {
    // ...
  }
}
```

```javascript
// app.js
import { UserCard } from './components/UserCard.js';
jqhtml.register(UserCard);  // Registers as "UserCard" using the class name
```

A static `component_name` property is only needed if the class name can't be trusted at runtime - most commonly when JS minification mangles class names. When present, it takes priority over the class name:

```javascript
// components/UserCard.js
export class UserCard extends Jqhtml_Component {
  static component_name = 'UserCard';  // Survives minification/name-mangling

  async on_load() {
    // ...
  }
}
```

```javascript
// app.js
import { UserCard } from './components/UserCard.js';
jqhtml.register(UserCard);  // Uses static component_name if defined, class name otherwise
```

### Framework Integrations

Some framework integrations (like [RSpade](https://rspade.org)) may handle registration automatically. Consult your specific framework integration's documentation for details.

### Template-Only Components

If a component has no JavaScript class (template-only), the framework uses the default `Jqhtml_Component` base class. Just register the template - no class registration needed.

## Component Class Structure

### Minimal Component

```javascript
class UserCard extends Jqhtml_Component {
  // No methods required - base class handles everything
}
```

### Component with Lifecycle

```javascript
class UserCard extends Jqhtml_Component {
  on_create() {
    // Quick setup after instance created
  }

  async on_load() {
    // Load data - ONLY modify this.data here
    this.data = await fetch(`/api/users/${this.args.user_id}`)
      .then(r => r.json());
  }

  on_ready() {
    // Attach event handlers
    this.$sid('button').on('click', () => {
      console.log('Clicked');
    });
  }
}
```

## Template Inheritance

JQHTML supports three inheritance mechanisms that work together to enable template reuse and specialization:

### 1. JavaScript Class Inheritance (Behavior)

Standard ES6 class inheritance for sharing logic and behavior:

```javascript
class DataGrid_Abstract extends Jqhtml_Component {
  async on_load() {
    this.data.records = await fetch(this.args.ajax_endpoint)
      .then(r => r.json());
  }

  sort_by(column) {
    // Shared sorting logic
  }
}

class UsersDataGrid extends DataGrid_Abstract {
  // Inherits on_load() and sort_by()

  async on_ready() {
    // Add user-specific behavior
    this.$sid('export_btn').on('click', () => this.export_users());
  }
}
```

### 2. extends Attribute (Template Structure)

Declare parent template for inheritance without requiring JavaScript class inheritance:

```jqhtml
<Define:ContactsDataGrid extends="DataGrid_Abstract">
  <Slot:header>
    <th>Name</th>
    <th>Email</th>
    <th>Phone</th>
  </Slot:header>

  <Slot:row>
    <td><%= row.name %></td>
    <td><%= row.email %></td>
    <td><%= row.phone %></td>
  </Slot:row>
</Define:ContactsDataGrid>
```

**How it works**:
- Component looks up parent template by name at runtime
- Child slots (`<Slot:header>`, `<Slot:row>`) are inserted into parent's `content('header')` and `content('row')` calls
- Parent template structure wraps child slot content
- Enables template-only inheritance patterns

**Use case**: When you want to reuse a template structure but don't need to share JavaScript behavior.

### 3. Slot-Based Inheritance (Automatic)

When a component template contains ONLY slots at the top level (no HTML), the framework automatically walks the JavaScript prototype chain to find the parent template:

```jqhtml
<Define:UsersDataGrid>
  <Slot:header>
    <th>ID</th>
    <th>Username</th>
    <th>Status</th>
  </Slot:header>

  <Slot:row>
    <td><%= row.id %></td>
    <td><%= row.username %></td>
    <td><%= row.status %></td>
  </Slot:row>
</Define:UsersDataGrid>
```

```javascript
// JavaScript class inherits from parent
class UsersDataGrid extends DataGrid_Abstract {
  // Framework automatically finds DataGrid_Abstract template
}
```

**How it works**:
- If template contains only slot definitions (no actual HTML)
- Framework walks `this.constructor` prototype chain
- Finds first parent class with a registered template
- Uses parent template with child's slot content

**Use case**: Natural inheritance pattern when both JS class and template should inherit from the same parent.

### Inheritance Resolution Order

Framework resolves templates in this order:

1. **Explicit template** - If component has registered template with HTML content
2. **extends attribute** - If `extends=""` specified on Define tag
3. **Prototype chain** - Walk JavaScript class hierarchy for parent templates

All three mechanisms can work together in the same component hierarchy.

### Combined Example

```javascript
// 1. Parent class with template
class DataGrid_Abstract extends Jqhtml_Component {
  async on_load() {
    this.data.records = await fetch(this.args.ajax_endpoint)
      .then(r => r.json());
  }
}
```

```jqhtml
<!-- Parent template -->
<Define:DataGrid_Abstract class="card datagrid">
  <table>
    <thead><tr><%= content('header') %></tr></thead>
    <tbody>
      <% for (let record of this.data.records) { %>
        <tr><%= content('row', record) %></tr>
      <% } %>
    </tbody>
  </table>
</Define:DataGrid_Abstract>
```

```javascript
// 2. Child class (JS inheritance)
class UsersDataGrid extends DataGrid_Abstract {
  // Inherits on_load() behavior
}
```

```jqhtml
<!-- 3. Child template (slot-based inheritance) -->
<Define:UsersDataGrid>
  <Slot:header>
    <th>ID</th>
    <th>Name</th>
  </Slot:header>

  <Slot:row>
    <td><%= row.id %></td>
    <td><%= row.name %></td>
  </Slot:row>
</Define:UsersDataGrid>
```

Result: UsersDataGrid gets both parent behavior (on_load) and parent template structure (table layout) while providing user-specific slots.

## Default Arguments (defineArgs)

Set default values for `$` attributes directly on the Define tag:

```jqhtml
<Define:DataGrid
    $per_page=25
    $sortable=true
    $ajax_endpoint="https://api.example.com/data"
    class="card">
  <div class="datagrid-header">
    Showing <%= this.args.per_page %> items per page
  </div>
  <div class="datagrid-body">
    <%= content() %>
  </div>
</Define:DataGrid>
```

**How it works**:
- Attributes starting with `$` on Define tag set default values for `this.args`
- Component invocations can override these defaults
- Enables template-only components with sensible defaults

**Syntax**:
- **Quoted values**: `$endpoint="http://api.com"` → String literal
- **Unquoted values**: `$count=25` → JavaScript expression (number)
- **Unquoted references**: `$handler=MyController.fetch` → JavaScript reference

**Example usage**:

```jqhtml
<!-- Uses defaults: per_page=25, sortable=true -->
<DataGrid />

<!-- Override defaults -->
<DataGrid $per_page=50 $sortable=false />

<!-- Override with JavaScript expression -->
<DataGrid $ajax_endpoint=this.data.api_url />
```

**Use case**: Configuration-driven components that work without backing JavaScript class, or providing sensible defaults for optional parameters.

## Component Data Access

### this.args - Component State

Component state that determines what data to load. Passed via `$` attributes and modifiable throughout the component lifecycle:

```javascript
// <UserCard $user_id="123" $theme="dark" />

class UserCard extends Jqhtml_Component {
  on_create() {
    console.log(this.args.user_id);  // "123"
    console.log(this.args.theme);     // "dark"

    // Modify state BEFORE on_load() runs
    this.args.filter = this.args.filter || 'all';

    // Set initial defaults in this.data
    this.data.loading = false;
  }

  async on_load() {
    // READ this.args to determine what to fetch
    // DO NOT modify this.args inside on_load()
    this.data = await fetch(`/api/users/${this.args.user_id}?filter=${this.args.filter}`)
      .then(r => r.json());
  }

  on_ready() {
    // Can modify this.args after on_load()
    this.$sid('filter_btn').on('click', () => {
      this.args.filter = 'active';
      this.reload();  // Re-runs on_load() with new args (debounced automatically)
    });
  }
}
```

**Key Rule**: `on_load()` can only READ `this.args`, not modify it. Modify `this.args` in other lifecycle methods.

### this.data - Loaded Data

Data set in `on_create()` (defaults) and loaded in `on_load()` (from APIs):

```javascript
class UserCard extends Jqhtml_Component {
  on_create() {
    // Set initial defaults (synchronous only, no API calls)
    this.data.loading = false;
    this.data.items = [];
  }

  async on_load() {
    // Fetch data from API (can be async)
    // this.data is restored to on_create() state before each on_load() call
    this.data = await fetch(`/api/users/${this.args.user_id}`)
      .then(r => r.json());
  }
}
```

**Key Rules**:
- `this.data` can ONLY be modified in `on_create()` (synchronous defaults) and `on_load()` (async fetching)
- `this.data` is frozen after `on_create()` completes, unfrozen during `on_load()`, then frozen again
- `this.data` is restored to its `on_create()` state before each `on_load()` execution
- `on_load()` can ONLY access `this.args` (read) and `this.data` (read/write). All other component properties/methods are blocked

### State Management

State is maintained on a case-by-case basis per component by:

1. **Manipulating the DOM directly**:
```javascript
class Counter extends Jqhtml_Component {
  increment() {
    const current = parseInt(this.$sid('count').text());
    this.$sid('count').text(current + 1);
  }
}
```

2. **Setting properties on the component class**:
```javascript
class Toggle extends Jqhtml_Component {
  on_create() {
    this.is_expanded = false;
  }

  toggle() {
    this.is_expanded = !this.is_expanded;
    this.$.toggleClass('expanded', this.is_expanded);
  }
}
```

The DOM IS the state - no separate state management system.

### this.$ - jQuery Element Reference

Direct jQuery reference to the component's root element:

```javascript
class UserCard extends Jqhtml_Component {
  on_ready() {
    this.$.addClass('loaded');
    this.$.find('.status').text('Online');
  }
}
```

### this.$sid(id) - Scoped ID Lookup

Access component-scoped IDs:

```javascript
// Template: <button $sid="submit">Submit</button>

class FormComponent extends Jqhtml_Component {
  on_ready() {
    this.$sid('submit').on('click', () => {
      this.handle_submit();
    });
  }
}
```

### this.sid(id) - Scoped Child Component Lookup

Distinct from `this.$sid(id)`: `this.sid(id)` returns the **child component instance** for a given scoped ID (not a jQuery element).

```javascript
// Template: <Child_Component $sid="child" />

class ParentComponent extends Jqhtml_Component {
  on_ready() {
    const child = this.sid('child');  // Returns the Child_Component instance
    child.reload();
  }
}
```

Use `this.$sid(id)` for jQuery/DOM access and `this.sid(id)` when you need to call methods or read properties on the child component instance itself.

## Component Naming Conventions

### Requirements

1. **Component names must start with a capital letter** - This is how the parser distinguishes `<UserCard>` (component) from `<div>` (HTML element)
2. **JS class name must match template name exactly** - `UserCard` class pairs with `<Define:UserCard>`

### Recommended Convention

Use `PascalCase` (standard JavaScript convention):

```javascript
class UserProfileCard extends Jqhtml_Component { }
class ProductListItem extends Jqhtml_Component { }
```

```jqhtml
<Define:UserProfileCard>
  <!-- Template content -->
</Define:UserProfileCard>
```

Any naming convention works as long as the first letter is capitalized and JS class matches template name.

## Using Components

### Within Templates (Child Components)

Once a component is running, its template can invoke other components:

```jqhtml
<Define:UserList>
  <div class="user-list">
    <% for (let user of this.data.users) { %>
      <UserCard $user_id=user.id $theme="light" />
    <% } %>
  </div>
</Define:UserList>
```

Child components can receive inner content:

```jqhtml
<Define:Dashboard>
  <UserPanel $title="Settings">
    <p>Panel content goes here</p>
    <button>Save</button>
  </UserPanel>
</Define:Dashboard>
```

### Programmatically (Top-Level Invocation)

The base library invokes top-level components programmatically via jQuery:

```javascript
// Create component on existing element (setter mode - returns jQuery object)
$('#container').component('UserCard', {
  user_id: 123,
  theme: 'dark'
});

// Create new element with component
$('<div>')
  .component('UserCard', {user_id: 123})
  .appendTo('#container');

// Create and get instance in one line
const component = $('<div>')
  .component('UserCard', {user_id: 123})
  .appendTo('#container')
  .component();  // Getter mode returns component instance

// Access existing component instance (getter mode)
const card = $('#user-card').component();
console.log(card.data);
```

This is the only way to invoke a top-level component with the core library.

### Framework Integration

Build-tool and framework integrations live in the [jqhtml GitHub organization](https://github.com/jqhtml):

- **Vite**: [`@jqhtml/vite-plugin`](https://github.com/jqhtml/jqhtml-vite) — import `.jqhtml` files directly in Vite builds
- **esbuild**: [`@jqhtml/esbuild-plugin`](https://github.com/jqhtml/jqhtml-esbuild) — same for esbuild
- **Laravel/Blade**: [`jqhtml/laravel`](https://github.com/jqhtml/jqhtml-laravel) composer package — a Blade precompiler for component syntax like `<UserCard $user_id="123" />` in server templates (in development; installs via `dev-main`)

For server-side rendering, `@jqhtml/ssr` provides the SEO/hydration path.

## Component Properties

### Automatic Properties

Every component gets:

- `this.$` - jQuery element reference
- `this.args` - Input arguments
- `this.data` - Data object (initially `{}`)
- `this.$sid(id)` - Scoped ID lookup method (returns a jQuery object)
- `this.sid(id)` - Scoped ID lookup method (returns the child component instance)
- `this._cid` - Unique component instance ID

### Custom Properties

```javascript
class Counter extends Jqhtml_Component {
  on_create() {
    this.count = 0;
    this.max = this.args.max || 100;
  }

  increment() {
    if (this.count < this.max) {
      this.count++;
      this.$sid('display').text(this.count);
    }
  }
}
```

## Component Registration Summary

For a component to work:

1. **Template**: Import and register the compiled `.jqhtml` file via `jqhtml.register_template()` or `jqhtml.register()`
2. **JavaScript class** (if any): Register via `jqhtml.register_component('Name', Class)` or `jqhtml.register(Class)` (uses the class name by default, or static `component_name` if defined)
3. The component name in the template (`<Define:Name>`) must match the registered class name

Template-only components work with just step 1. Components with behavior require both steps.

## Multiple Instances

Each component instance is independent:

```javascript
// Create three separate instances
$('#card1').component('UserCard', {user_id: 1});
$('#card2').component('UserCard', {user_id: 2});
$('#card3').component('UserCard', {user_id: 3});

// Each has its own data and state
```

## Component Identification

All components get the `Component` CSS class:

```javascript
// Find all component instances
$('.Component').each(function() {
  const component = $(this).component();
  console.log(component.constructor.name);
});

// Check if element is a component
if ($element.hasClass('Component')) {
  // It's a component
}
```

## Key Concepts

1. **Explicit registration** - Both templates and classes require explicit registration via `register()`, `register_template()`, or `register_component()`
2. **Unified register()** - Auto-detects templates (via `__jqhtml_template`) and classes (via `static component_name`)
3. **Three inheritance mechanisms** - JavaScript class, extends attribute, and slot-based
4. **defineArgs on Define** - Set default values for `$` attributes on Define tag
5. **this.args = input** - Read-only configuration
6. **this.data = loaded data** - Dynamically loaded data for the template
7. **State via DOM** - The DOM is the state, manipulate it directly
8. **this.$ = element** - Direct jQuery access
9. **Each instance independent** - No shared state
10. **jQuery integration** - Components are jQuery objects
