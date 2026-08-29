# JQHTML API Reference

## Core Components

### Jqhtml_Component Class

The base class for all JQHTML components. Components are genuine jQuery objects with lifecycle methods.

#### Properties

- `this.$` - The component's root jQuery element
- `this.data` - Initial data passed to constructor
- `this._cid` - Unique component instance ID
- `this._lifecycle_state` - Current lifecycle phase

#### Lifecycle Methods

Methods called in this specific order:

```javascript
render() // Create DOM (top-down)
create() // Quick setup (bottom-up)
load()   // Async data fetch (parallel, NO DOM)
ready()  // Fully initialized (bottom-up)
```

#### Overridable Hooks

- `on_create()` - Sync. Set defaults on `this.data` before first render
- `on_render()` - Sync. Immediately after DOM update, before children are ready
- `on_load()` - Async. Fetch data into `this.data` (no DOM access)
- `on_loaded()` - Async. After `on_load()`, on the real component (`this.data` frozen)
- `on_ready()` - Async. All children ready, safe for DOM manipulation
- `on_stop()` - Sync. Cleanup (timers, connections)
- `on_viewport_resize(viewport_width)` - Sync. Viewport width in CSS pixels
  (`window.innerWidth`). Fires after every `on_render()`, after every `on_ready()`, and
  on window resize — one framework-owned listener, debounced 30ms, dispatched to every
  component in the document. Do not bind `$(window).on('resize')` in a component.

#### DOM Access Methods

- `$sid(name)` - Get element with scoped ID (`$sid="name"` in template)
- `$.find(selector)` - Standard jQuery find within component
- `$.children()` - Get direct jQuery children

#### Event Methods

- `emit(eventName, data)` - Emit jQuery event on component
- `on(event, handler)` - jQuery event binding
- `off(event)` - Remove event handlers

### Template Syntax

#### Output Expressions

```jqhtml
<%= expr %>   // Escaped output
<%! expr %>   // Unescaped HTML output
<% code %>    // Execute JavaScript
```

#### Control Flow

Both colon and brace styles supported:

```jqhtml
<% if (condition) { %>
  content
<% } else { %>
  other
<% } %>

<% for (let item of items) { %>
  <%= item %>
<% } %>
```

#### Component Attributes

```jqhtml
$sid="name"           // Scoped ID (becomes name:_cid)
@click=this.method    // Bind to component method
@click="method"      // Alternative syntax
$class="dynamic"     // Dynamic class binding
$data-foo="value"    // Data attributes
```

### Global jqhtml Object

#### Registration Methods

```javascript
jqhtml.register_component(name, ComponentClass)
jqhtml.register_template(name, {as: 'div', render: fn})
jqhtml.get_component(name)
jqhtml.get_template(name)
```

#### Debug Methods

```javascript
jqhtml.showDebugOverlay()    // Show debug panel
jqhtml.hideDebugOverlay()    // Hide debug panel
jqhtml.debug = true          // Enable debug logging
```

#### Component Creation

```javascript
// Direct instantiation
const component = new MyComponent({data: 'here'});
$('#container').append(component.$);

// Via registered name
const component = jqhtml.create('MyComponent', {data: 'here'});
```

## Parser API

### Compiler Functions

```javascript
import { compile } from '@jqhtml/parser';

// Compile template string to render function
const renderFn = compile(templateString, {
  filename: 'Component.jqhtml',
  sourceMap: true
});
```

### Parser Options

```javascript
{
  filename: string,      // For source maps
  sourceMap: boolean,    // Generate source maps
  minify: boolean,       // Minify output
  format: 'esm' | 'cjs' // Output format
}
```

## Router API

### Jqhtml_SPA Class

Single Page Application container.

```javascript
class MySPA extends Jqhtml_SPA {
  constructor(args) {
    super(args);
    this.router = new Jqhtml_Router();
  }
}
```

### Jqhtml_Router Class

Handles route registration and navigation.

```javascript
const router = new Jqhtml_Router();

// Register routes
router.register('/', HomeRoute);
router.register('/users/:id', UserRoute);

// Navigate
router.navigate('/users/123');

// Get current route
const current = router.current_route;
```

### Route Components

```javascript
class UserRoute extends Jqhtml_Route {
  render() {
    const userId = this.params.id;
    return `<h1>User ${userId}</h1>`;
  }
}
```

### Layout Components

Persist across route changes:

```javascript
class MainLayout extends Jqhtml_Layout {
  should_rerender() {
    return false; // Persist across routes
  }

  render() {
    return `
      <header>App Header</header>
      <div $sid="content"></div>
      <footer>App Footer</footer>
    `;
  }
}
```

## Webpack Loader API

### Configuration

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [{
      test: /\.jqhtml$/,
      use: '@jqhtml/webpack-loader'
    }]
  }
};
```

### Loader Options

```javascript
{
  test: /\.jqhtml$/,
  use: {
    loader: '@jqhtml/webpack-loader',
    options: {
      sourceMap: true,
      minify: false,
      autoRegister: true  // Auto-register components
    }
  }
}
```

## jQuery Extensions

### Component Plugin

```javascript
// Setter mode - Create component on element (returns jQuery object)
$('#container').component(MyComponent, {data: 'here'});

// Setter with chaining
$('<div>')
  .component('User_Card', {user_id: 123})
  .appendTo('#container');

// Create and get instance in one line
const instance = $('<div>')
  .component('User_Card', {user_id: 123})
  .appendTo('#container')
  .component();  // Getter mode

// Getter mode - Get existing component instance
const instance = $('#container').component();

// Check if element has component
if ($('#container').hasComponent()) {
  // ...
}

// Stop component
$('#container').stopComponent();
```

**Key distinction:**
- `.component('Name', args)` → Returns **jQuery object** (for chaining)
- `.component()` → Returns **component instance**

### Value Override

Components can override jQuery's val() method:

```javascript
class CustomInput extends Jqhtml_Component {
  val(value) {
    if (arguments.length === 0) {
      // Getter
      return this.processValue(this.$sid('input').val());
    } else {
      // Setter
      this.$sid('input').val(this.validateValue(value));
      return this.$; // jQuery chaining
    }
  }
}
```

## Event System

### Component Events

```javascript
// Emit custom event
component.emit('user:updated', {id: 123});

// Listen to component events
component.on('user:updated', (e, data) => {
  console.log('User updated:', data.id);
});

// Global component events
$(document).on('jqhtml:ready', (e, component) => {
  console.log('Component ready:', component);
});
```

### Template Event Binding

```jqhtml
<!-- Method name -->
<button @click=this.handleClick>Click</button>

<!-- With event parameter: the handler receives the event -->
<button @click=this.handleEvent>Event</button>

<!-- Other events -->
<input @change=this.updateValue />
<form @submit=this.handleSubmit />
```

## Advanced Features

### Slots

```jqhtml
<Define:Card>
  <div class="card">
    <div class="card-header">
      <#header />
    </div>
    <div class="card-body">
      <#default />
    </div>
  </div>
</Define:Card>

<!-- Usage -->
<Card>
  <#header>Card Title</#header>
  Card content goes here
</Card>
```

### Dynamic Components

```javascript
// Register component dynamically
jqhtml.register_component('DynamicCard', class extends Jqhtml_Component {
  render() {
    return '<div>Dynamic!</div>';
  }
});

// Create by name
const component = jqhtml.create('DynamicCard');
```

### Server-Side Rendering

```php
// PHP integration
Jqhtml::component('UserCard', ['userId' => 123]);

// Outputs initialization div
<div class="Jqhtml_Component_Init"
     data-component-init-name="UserCard"
     data-component-params='{"userId":123}'></div>
```

### Client-Side Hydration

```javascript
// Find and initialize server-rendered components
$('.Jqhtml_Component_Init').each(function() {
  const $el = $(this);
  const name = $el.data('component-init-name');
  const params = $el.data('component-params');

  const ComponentClass = jqhtml.get_component(name);
  if (ComponentClass) {
    const instance = new ComponentClass(params);
    $el.replaceWith(instance.$);
  }
});
```

## Performance Optimization

### Lifecycle Batching

Components batch lifecycle phases for optimal performance:
- All components complete render before any create
- Load phases run in parallel
- Ready phases respect dependency order

### Re-render Control

```javascript
class OptimizedComponent extends Jqhtml_Component {
  should_rerender() {
    // Control when component re-renders after load
    return this.data_changed;
  }
}
```

### Debug Performance

```javascript
// Enable performance profiling
jqhtml.debug = true;
jqhtml.showDebugOverlay();

// Slow render detection (> 16ms)
window.JQHTML_SLOW_RENDER_THRESHOLD = 16;
```