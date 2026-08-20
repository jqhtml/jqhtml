# Debugging Tools

## Overview

JQHTML includes debugging tools for component development, lifecycle tracking, and performance profiling.

## Verbose Logging

### Enable Internal Logging

```javascript
// In browser console or app initialization
window.jqhtml.debug.verbose = true;
```

This enables detailed internal logging of:
- Component initialization
- Lifecycle method execution
- Render operations
- Data loading
- Event handling

### Log Output Example

```
[JQHTML] Initializing component: UserCard (c123)
[JQHTML] UserCard.on_create() started
[JQHTML] UserCard.on_create() completed (2ms)
[JQHTML] UserCard.on_load() started
[JQHTML] UserCard.on_load() completed (145ms)
[JQHTML] UserCard.on_ready() started
[JQHTML] UserCard.on_ready() completed (5ms)
```

## Component Inspection

### Accessing Component from Console

```javascript
// Select element in DevTools, then:
const component = $0.component();

// Or by ID:
const component = $('#user-card').component();

// Inspect properties
console.log(component.args);
console.log(component.data);
console.log(component._cid);
```

### Listing All Components

```javascript
// Find all components on page
$('.Component').each(function() {
  const comp = $(this).component();
  console.log(comp.constructor.name, comp._cid);
});
```

### Component Tree Visualization

```javascript
function debugComponentTree(root = document.body) {
  $(root).find('.Component').each(function(i) {
    const comp = $(this).component();
    const depth = $(this).parents('.Component').length;
    const indent = '  '.repeat(depth);
    console.log(`${indent}${comp.constructor.name} (#${comp._cid})`);
  });
}

debugComponentTree();
```

## Performance Profiling

### Manual Profiling

```javascript
class HeavyComponent extends Jqhtml_Component {
  on_ready() {
    console.time('HeavyComponent.on_ready');

    // ... expensive operations ...

    console.timeEnd('HeavyComponent.on_ready');
  }
}
```

### Lifecycle Timing

```javascript
class Dashboard extends Jqhtml_Component {
  on_create() {
    this._create_start = performance.now();
  }

  on_ready() {
    const total = performance.now() - this._create_start;
    console.log(`Dashboard init took ${total}ms`);
  }
}
```

## Visual Component Debugging

### Highlighting Component Boundaries

```javascript
// Add borders to all components for debugging
$('.Component').css('outline', '2px solid red');
```

### Color-Coding Lifecycle Stages

```javascript
class DebugComponent extends Jqhtml_Component {
  on_render() {
    // on_render fires after DOM created, before children boot
    this.$.css('background', '#ccccff');  // Blue after render
  }

  on_ready() {
    this.$.css('background', '#ccffcc');  // Green when ready
  }
}
```

**Note:** `this.$` is available in `on_render()`, `on_loaded()`, and `on_ready()`. It is not available in `on_create()` or `on_load()`.

## Common Debugging Patterns

### Lifecycle Debugging

```javascript
class UserCard extends Jqhtml_Component {
  on_create() {
    console.log('UserCard.on_create()', this.args);
  }

  async on_load() {
    console.log('UserCard.on_load() start');
    this.data = await fetch(`/api/users/${this.args.user_id}`)
      .then(r => r.json());
    console.log('UserCard.on_load() end', this.data);
  }

  on_ready() {
    console.log('UserCard.on_ready()');
    console.log('  this.$:', this.$);
    console.log('  this.args:', this.args);
    console.log('  this.data:', this.data);
  }
}
```

### Data Flow Debugging

```javascript
class Parent extends Jqhtml_Component {
  on_ready() {
    console.group('Parent component ready');

    // Check child components
    this.$.find('.Component').each(function() {
      const child = $(this).component();
      console.log('Child:', child.constructor.name);
      console.log('  args:', child.args);
      console.log('  data:', child.data);
    });

    console.groupEnd();
  }
}
```

### Event Debugging

```javascript
class Button extends Jqhtml_Component {
  on_ready() {
    this.$.on('click', (e) => {
      console.log('Button clicked');
      console.log('  Event:', e);
      console.log('  Target:', e.target);
      console.log('  Component:', this);
    });

    // Debug ALL DOM events firing on this element: jQuery/JQHTML have no
    // wildcard '*' event matching, so list the specific events you care about
    ['click', 'mouseenter', 'mouseleave', 'focus', 'blur'].forEach((type) => {
      this.$.on(type, (e) => {
        console.log(`Event fired: ${e.type}`);
      });
    });

    // Debug JQHTML lifecycle events (create/render/load/loaded/ready/stop)
    // via the component's own .on(), not jQuery's
    ['create', 'render', 'load', 'loaded', 'ready', 'stop'].forEach((type) => {
      this.on(type, () => {
        console.log(`Lifecycle event fired: ${type}`);
      });
    });
  }
}
```

## Debugging Common Issues

### Component Not Initializing

```javascript
// Check what's registered
console.log(jqhtml.list_components());
// { "UserCard": { has_class: true, has_template: true }, ... }

// Check if specific template registered
console.log(jqhtml.get_template('UserCard'));  // Template definition or default

// Check if element has class
console.log($('#my-card').hasClass('Component'));  // Should be true

// Listen for ready event (use component's .on(), not jQuery's)
$('#my-card').component().on('ready', () => {
  console.log('Component ready event fired');
});
```

### Data Not Loading

```javascript
class UserCard extends Jqhtml_Component {
  async on_load() {
    console.log('Loading data for user:', this.args.user_id);

    try {
      const response = await fetch(`/api/users/${this.args.user_id}`);
      console.log('Response status:', response.status);

      this.data = await response.json();
      console.log('Data loaded:', this.data);
    } catch (error) {
      console.error('Load failed:', error);
    }
  }
}
```

### Scoped ID Not Found

```javascript
class Card extends Jqhtml_Component {
  on_ready() {
    const element = this.$sid('title');

    if (element.length === 0) {
      console.error('Element with $sid="title" not found');
      // Find all scoped IDs belonging to this component (id ends with :_cid)
      const scopedIds = $(`[id$=":${this._cid}"]`).map(function() {
        return $(this).attr('id').split(':')[0];  // Extract the local ID part
      }).get();
      console.log('Available scoped IDs:', scopedIds);
    }
  }
}
```

### Parent-Child Issues

```javascript
class Parent extends Jqhtml_Component {
  on_ready() {
    const child = this.$sid('child_component').component();

    if (!child) {
      console.error('Child component not found');
      console.log('Children:', this.$.find('.Component').length);
      return;
    }

    console.log('Child ready:', child.constructor.name);
  }
}
```

## Browser DevTools Integration

### Component Property Inspector

```javascript
// Make component accessible globally for debugging
window.debugComponent = function(selector) {
  const comp = $(selector).component();
  console.log('Component:', comp.constructor.name);
  console.table(comp.args);
  console.table(comp.data);
  return comp;
};

// Usage in console:
// debugComponent('#user-card')
```

### Breakpoint Debugging

```javascript
class UserCard extends Jqhtml_Component {
  on_ready() {
    debugger;  // Break here in DevTools

    this.$sid('button').on('click', () => {
      debugger;  // Break on click
      this.handle_click();
    });
  }
}
```

## RSpade Debug Integration

### console_debug() Function

```javascript
// In component
class Dashboard extends Jqhtml_Component {
  on_ready() {
    console_debug('COMPONENT', 'Dashboard ready', {
      args: this.args,
      data: this.data
    });
  }
}
```

**Server-side filtering:**
```bash
CONSOLE_DEBUG_FILTER=COMPONENT php artisan serve
```

### RSpade rsx:debug Command

Test pages with full component initialization:

```bash
php artisan rsx:debug /dashboard
php artisan rsx:debug /dashboard --user=1
php artisan rsx:debug /dashboard --expect-element=".UserCard"
```

## Tips and Best Practices

1. **Enable verbose logging early** - `window.jqhtml.debug.verbose = true`
2. **Console.log liberally** - In lifecycle methods
3. **Inspect component instances** - `$('#element').component()`
4. **Check component tree** - Parent-child relationships
5. **Profile slow operations** - Use console.time/timeEnd
6. **Visual debugging** - Outline components with CSS
7. **Breakpoint in lifecycle** - Use `debugger;`
8. **Test in isolation** - Create minimal test pages
9. **Check bundle includes** - Ensure components compiled

## Key Debugging Tools

1. **jqhtml.list_components()** - See what's registered
2. **jqhtml._version()** - Check core and template versions
3. **window.jqhtml.debug.verbose** - Enable internal logging
4. **.component()** - Access component instance from jQuery
5. **console.log in lifecycle** - Track execution flow
6. **debugger statement** - Browser breakpoints
7. **Component tree inspection** - Parent-child relationships
8. **Performance profiling** - Timing lifecycle stages
9. **RSpade rsx:debug** - Server-side component testing (RSpade only)
10. **console_debug()** - Channel-based logging (RSpade only)
