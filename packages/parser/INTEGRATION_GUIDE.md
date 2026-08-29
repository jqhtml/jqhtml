# JQHTML Crash Course for RSPADE Integration

## Quick Overview
JQHTML is a jQuery-first component framework that treats the DOM as the source of truth. No virtual DOM, no state management - just jQuery with a thin component layer on top. Components are genuine jQuery objects where `this.$` is real jQuery.

## Component Class Structure

### Basic Component
```javascript
// Component classes MUST extend Jqhtml_Component
// Class names use Upper_Case_With_Underscores
class User_Card extends Jqhtml_Component {

  // Four lifecycle methods, called in this EXACT order:

  render() {
    // 1. RENDER - Create the DOM (runs top-down through component tree)
    // Return HTML string or use registered template
    return `
      <div class="user-card">
        <h3 $sid="name"></h3>
        <button $sid="edit_btn">Edit</button>
      </div>
    `;
  }

  create() {
    // 2. CREATE - Quick setup after DOM exists (runs bottom-up)
    // Good for: binding events, setting initial state
    // DOM exists but children might not be ready yet
    this.$sid('edit_btn').on('click', () => this.edit_user());
  }

  load() {
    // 3. LOAD - Async data fetching (all components run in parallel)
    // ⚠️ CRITICAL: NO DOM MODIFICATIONS IN load()
    // Only fetch data here
    return fetch(`/api/user/${this.data.user_id}`)
      .then(res => res.json())
      .then(user => this.user = user);
  }

  ready() {
    // 4. READY - Component fully initialized (runs bottom-up)
    // Safe to modify DOM, all data loaded
    this.$sid('name').text(this.user.name);
    this.$.addClass('loaded');
  }
}
```

## Accessing the DOM

### jQuery Integration
```javascript
class My_Component extends Jqhtml_Component {
  ready() {
    // this.$ is the component's root element as jQuery object
    this.$.addClass('initialized');

    // this.$sid('foo') gets element with $sid="foo" from template
    // Returns jQuery object scoped to this component
    const name = this.$sid('name_input').val();
    this.$sid('status').text('Ready');

    // Regular jQuery selectors work too
    this.$.find('.item').hide();
    this.$.children('div').fadeIn();

    // Get raw DOM element
    const domElement = this.$[0];
  }
}
```

## Template Syntax

### Define Component Templates
```html
<!-- Template files use .jqhtml extension -->
<Define:User_Card>
  <div class="user-card">
    <!-- $sid creates component-scoped IDs -->
    <h3 $sid="title"><%= this.data.title %></h3>

    <!-- Event handlers call component methods -->
    <button $sid="save_btn" @click=this.save>Save</button>
    <button @click="delete_user">Delete</button>

    <!-- All standard events supported -->
    <input $sid="search" @keyup=this.do_search />
    <select $sid="options" @change=this.option_changed>
      <% for (let opt of this.data.options) { %>
        <option value="<%= opt.value %>"><%= opt.label %></option>
      <% } %>
    </select>
  </div>
</Define:User_Card>
```

### Key Template Features
- `$sid="name"` - Creates component-scoped ID (becomes `name:_cid123`)
- `@click=this.method` - Binds to component method
- `@click="method"` - Alternative syntax (converts to `data-on-click`)
- `<%= expr %>` - Output escaped JavaScript expression
- `<%! expr %>` - Output unescaped (raw HTML)
- `<% code %>` - Execute JavaScript code
- Supports both `:` and `{}` control flow styles

## Server-Side Integration (PHP/RSPADE)

### Rendering Components from PHP
```php
// In your blade/RSPADE template:
{!! Jqhtml::component("User_Card", ['user_id' => 123, 'editable' => true]) !!}

// This outputs:
// <div class="Jqhtml_Component_Init"
//      data-component-init-name="User_Card"
//      data-component-params='{"user_id":123,"editable":true}'></div>
```

### Implementing the PHP Helper
```php
// You'll need to create this Jqhtml class if it doesn't exist
class Jqhtml {
    public static function component($name, $params = []) {
        return sprintf(
            '<div class="Jqhtml_Component_Init" data-component-init-name="%s" data-component-params="%s"></div>',
            htmlspecialchars($name),
            htmlspecialchars(json_encode($params))
        );
    }
}
```

### Client-Side Initialization
```javascript
// Add this to your main app initialization
// Finds all Jqhtml_Component_Init divs and creates components
$(document).ready(() => {
    $('.Jqhtml_Component_Init').each(function() {
        const $el = $(this);
        const componentName = $el.data('component-init-name');
        const params = $el.data('component-params') || {};

        // Get the component class (must be globally accessible)
        const ComponentClass = window[componentName];
        if (!ComponentClass) {
            console.error(`Component class ${componentName} not found`);
            return;
        }

        // Create and mount the component
        const instance = new ComponentClass(params);
        $el.replaceWith(instance.$);
    });
});
```

## File Organization

### Recommended Structure
```
/resources/js/components/
  User_Card.js         # Component class
  User_Card.jqhtml     # Template (optional)
  Product_List.js
  Product_List.jqhtml

/app/Helpers/
  Jqhtml.php          # PHP helper class
```

### Self-Registration
Component files are self-registering when loaded via webpack. No need for manual registration:

```javascript
// User_Card.js
class User_Card extends Jqhtml_Component {
  // ... component code
}

// Self-register (happens automatically with webpack loader)
if (typeof jqhtml !== 'undefined') {
  jqhtml.register_component('User_Card', User_Card);
}

// Make available globally for server-rendered init
window.User_Card = User_Card;
```

## Complete Working Example

### 1. Component Class (User_Card.js)
```javascript
class User_Card extends Jqhtml_Component {
  render() {
    return `
      <div class="user-card" data-user-id="${this.data.user_id}">
        <div class="loading">Loading...</div>
        <div class="content" style="display:none;">
          <h3 $sid="name"></h3>
          <p $sid="email"></p>
          <button $sid="edit_btn" @click=this.edit>Edit</button>
          <button $sid="delete_btn" @click="delete_user">Delete</button>
        </div>
      </div>
    `;
  }

  create() {
    // Set up any initial state
    this.editing = false;
  }

  load() {
    // Fetch user data (NO DOM manipulation here!)
    return fetch(`/api/users/${this.data.user_id}`)
      .then(res => res.json())
      .then(data => this.user = data);
  }

  ready() {
    // Update DOM with loaded data
    this.$sid('name').text(this.user.name);
    this.$sid('email').text(this.user.email);

    // Hide loading, show content
    this.$.find('.loading').hide();
    this.$.find('.content').fadeIn();
  }

  edit() {
    // Component method called by $onclick
    console.log('Editing user:', this.user.id);
    // Open edit modal, etc.
  }

  delete_user() {
    if (confirm('Delete this user?')) {
      fetch(`/api/users/${this.user.id}`, {method: 'DELETE'})
        .then(() => this.$.fadeOut(() => this.$.remove()));
    }
  }
}

// Make available globally
window.User_Card = User_Card;
```

### 2. PHP/Blade Template
```php
@extends('layouts.app')

@section('content')
<div class="container">
    <h1>Users</h1>

    @foreach($users as $user)
        {!! Jqhtml::component('User_Card', ['user_id' => $user->id]) !!}
    @endforeach
</div>

<script>
$(document).ready(() => {
    // Initialize all JQHTML components on the page
    $('.Jqhtml_Component_Init').each(function() {
        const $el = $(this);
        const componentName = $el.data('component-init-name');
        const params = $el.data('component-params');

        const ComponentClass = window[componentName];
        if (ComponentClass) {
            const instance = new ComponentClass(params);
            $el.replaceWith(instance.$);
        }
    });
});
</script>
@endsection
```

## Common Patterns

### Updating Component Display
```javascript
class My_Component extends Jqhtml_Component {
  update_display() {
    // Use jQuery to update DOM
    this.$sid('count').text(this.count);
    this.$sid('status').toggleClass('active', this.is_active);

    // Remember: the DOM IS the state
    // No virtual DOM, no diffing, just direct manipulation
  }
}
```

### Component Communication
```javascript
class Parent_Component extends Jqhtml_Component {
  ready() {
    // Find child components
    this.$.find('.child-component').each((i, el) => {
      const childInstance = $(el).data('jqhtml-instance');
      if (childInstance) {
        // Call child methods directly
        childInstance.update_something();
      }
    });
  }
}
```

## Important Notes

1. **NO Virtual DOM** - Direct DOM manipulation is the way
2. **NO Automatic Re-rendering** - You explicitly update the DOM when needed
3. **jQuery First** - `this.$` is a real jQuery object, use it freely
4. **Lifecycle Order Matters** - render → create → load → ready (always in this order)
5. **load() is Special** - NEVER modify DOM in load(), only fetch data
6. **Components are jQuery** - They can be treated like any jQuery element

## Debugging

```javascript
// Enable debug mode
window.jqhtml_debug = true;

// Access component instance from DOM
const instance = $('.user-card').data('jqhtml-instance');
console.log(instance.user);

// Check lifecycle completion
console.log(instance._lifecycle_state); // 'ready' when complete
```

## What You Need to Implement

1. **Jqhtml PHP Helper Class** - For server-side rendering
2. **Client-side Initialization** - The jQuery ready handler to init components
3. **Webpack Configuration** - To load .jqhtml templates (optional)
4. **Component Classes** - Your actual components extending Jqhtml_Component

The key insight: JQHTML components are just jQuery objects with lifecycle methods. No magic, no complexity - just jQuery with structure.