# Component Nesting and content()

## Overview

JQHTML components can be nested within other components. The `content()` function allows parent components to receive and render content passed by their children.

## Basic Nesting

### Simple Nesting

```jqhtml
<Define:UserList>
  <div class="list">
    <% for (let user of this.data.users) { %>
      <UserCard $user_id=user.id $name="<%= user.name %>" />
    <% } %>
  </div>
</Define:UserList>

<Define:UserCard>
  <div class="card">
    <h3><%= this.args.name %></h3>
  </div>
</Define:UserCard>
```

## content() Function

### What is content()?

`content()` allows a component to render content that was passed to it from the outside.

### Basic Usage

```jqhtml
<Define:Panel>
  <div class="panel">
    <div class="panel-header"><%= this.args.title %></div>
    <div class="panel-body">
      <%= content() %>
    </div>
  </div>
</Define:Panel>
```

**Using the component:**

```jqhtml
<Panel $title="User Settings">
  <p>This content will appear inside the panel body</p>
  <button>Save Settings</button>
</Panel>
```

**Rendered result:**

```html
<div class="panel">
  <div class="panel-header">User Settings</div>
  <div class="panel-body">
    <p>This content will appear inside the panel body</p>
    <button>Save Settings</button>
  </div>
</div>
```

## How content() Works

### Instruction Flattening

Templates compile to instruction arrays. When `<%= content() %>` is called, it returns a `['_content', instructions]` marker.

The `_flatten_instructions()` function recursively flattens these markers before processing, preserving the instruction structure instead of converting to strings.

### Template Compilation

```jqhtml
<Panel $title="Settings">
  <input type="text" />
</Panel>
```

This compiles to instructions that get flattened and inserted where `<%= content() %>` appears in the Panel template.

## Nested Components with content()

### Wrapper Components

```jqhtml
<Define:Card>
  <div class="card">
    <div class="card-body">
      <%= content() %>
    </div>
  </div>
</Define:Card>

<Define:Dashboard>
  <div class="dashboard">
    <Card>
      <h2>Welcome</h2>
      <p>Dashboard content here</p>
      <UserStats $user_id=this.args.user_id />
    </Card>
  </div>
</Define:Dashboard>
```

### Layout Components

```jqhtml
<Define:TwoColumnLayout>
  <div class="layout">
    <div class="left-column">
      <%= content('left') %>
    </div>
    <div class="right-column">
      <%= content('right') %>
    </div>
  </div>
</Define:TwoColumnLayout>
```

**Note**: Named content slots use the slot system (see slots documentation).

## Server-Rendered Content Integration

### _inner_html Property

JQHTML allows server-rendered frameworks (like Blade in RSpade) to provide pre-rendered HTML content:

```javascript
$('#container').component('Card', {
  _inner_html: '<p>Pre-rendered HTML from server</p>'
});
```

This bypasses the `content()` rendering and uses the provided HTML string directly.

**Note**: In practice, `_inner_html` is normally set for you by the boot()/SSR hydration flow (see `/docs/reference/18_boot.md`) rather than passed manually in application code - the server emits a `_Component_Init` placeholder carrying the pre-rendered HTML, and `jqhtml.boot()` wires it up via `_inner_html` when hydrating. The direct manual call shown above is the underlying mechanism, useful to understand but rarely written by hand.

**Important**: Only works with the default slot, not named slots.

### Why This Matters

Allows integration with server-side rendering frameworks where the server generates the inner HTML and passes it to the component.

## Complex Nesting Example

```jqhtml
<Define:AppLayout>
  <div class="app">
    <header><%= this.args.header_title %></header>
    <main>
      <%= content() %>
    </main>
    <footer>© 2025</footer>
  </div>
</Define:AppLayout>

<Define:Dashboard>
  <AppLayout $header_title="Dashboard">
    <div class="dashboard-grid">
      <StatCard $label="Users" $value=this.data.user_count />
      <StatCard $label="Revenue" $value=this.data.revenue />
      <StatCard $label="Orders" $value=this.data.orders />
    </div>
  </AppLayout>
</Define:Dashboard>

<Define:StatCard>
  <div class="stat-card">
    <div class="label"><%= this.args.label %></div>
    <div class="value"><%= this.args.value %></div>
  </div>
</Define:StatCard>
```

## Dynamic Nesting

### Conditional Components

```jqhtml
<Define:UserProfile>
  <Card>
    <h2><%= this.data.user.name %></h2>

    <% if (this.data.user.is_premium) { %>
      <PremiumBadge />
    <% } %>

    <% if (this.data.user.badges.length > 0) { %>
      <BadgeList $badges=this.data.user.badges />
    <% } %>
  </Card>
</Define:UserProfile>
```

### Loop-Based Nesting

```jqhtml
<Define:ProductGrid>
  <div class="grid">
    <% for (let product of this.data.products) { %>
      <ProductCard
        $sid=product.id
        $name="<%= product.name %>"
        $price=product.price
      >
        <% if (product.on_sale) { %>
          <SaleBadge $discount=product.discount />
        <% } %>
      </ProductCard>
    <% } %>
  </div>
</Define:ProductGrid>
```

## Accessing Nested Components

### From Parent to Child

```javascript
class Dashboard extends Jqhtml_Component {
  on_ready() {
    // Access child component by scoped ID
    const card = this.$sid('user_card').component();

    // Call child methods
    card.update_data(new_data);

    // Access child properties
    console.log(card.data.user_name);
  }
}
```

### Component Tree Traversal

```javascript
class ParentComponent extends Jqhtml_Component {
  on_ready() {
    // Find all child components
    this.$.find('.Component').each(function() {
      const child = $(this).component();
      console.log(child.constructor.name);
    });
  }
}
```

## Important Concepts

1. **content() renders passed content** - Whatever was between component tags
2. **Instruction flattening** - Preserves structure, not converted to strings
3. **_inner_html for server rendering** - Bypass content() with pre-rendered HTML
4. **Nested components independent** - Each has own lifecycle
5. **Parent waits for children** - ready() only fires when children are ready
6. **Access via .component()** - jQuery method to get component instance
7. **Default slot only** - _inner_html works only with default content(), not named slots

## Self-Closing vs Content Components

### Self-Closing (No Content)

```jqhtml
<UserCard $user_id="123" />
```

### With Content

```jqhtml
<Panel $title="Settings">
  <p>Content goes here</p>
</Panel>
```

Both syntaxes valid - use self-closing when no inner content needed.

## Key Rules

1. Use `<%= content() %>` to render passed content
2. Components can be nested arbitrarily deep
3. Each component manages its own lifecycle
4. Parent `on_ready()` fires after all children ready
5. Server-rendered HTML via `_inner_html` property
6. Access children via `.component()` jQuery method
