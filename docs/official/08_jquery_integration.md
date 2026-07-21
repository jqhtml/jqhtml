# jQuery Integration and .val() Override

## Overview

JQHTML components are **genuine jQuery objects**. The `this.$` property is a real jQuery reference, not a wrapper or abstraction. This means all jQuery methods work directly on components.

## Core Concept: Components ARE jQuery

### this.$ - The jQuery Reference

Every component has `this.$` which is a jQuery object referencing the component's root element:

```javascript
class UserCard extends Jqhtml_Component {
  on_ready() {
    // this.$ is a real jQuery object
    this.$.addClass('active');
    this.$.css('background', '#f0f0f0');
    this.$.fadeIn(300);
    this.$.on('click', () => {
      console.log('Card clicked');
    });
  }
}
```

### All jQuery Methods Available

```javascript
class Dashboard extends Jqhtml_Component {
  on_ready() {
    // Manipulation
    this.$.append('<div>New content</div>');
    this.$.empty();
    this.$.remove();

    // Traversal
    this.$.find('.item').addClass('selected');
    this.$.parent().addClass('has-dashboard');
    this.$.siblings().hide();

    // CSS
    this.$.width(500);
    this.$.height(300);
    this.$.offset();

    // Effects
    this.$.slideDown();
    this.$.animate({opacity: 0.5}, 1000);
  }
}
```

## Component-Scoped IDs with this.$sid()

### What is $sid()?

Method for accessing component-scoped IDs (created with `$sid` attribute):

```jqhtml
<Define:UserCard>
  <div>
    <h3 $sid="title">Name</h3>
    <p $sid="email">Email</p>
    <button $sid="edit_btn">Edit</button>
  </div>
</Define:UserCard>
```

```javascript
class UserCard extends Jqhtml_Component {
  on_ready() {
    // Access scoped IDs
    this.$sid('title').text('John Doe');
    this.$sid('email').text('john@example.com');
    this.$sid('edit_btn').on('click', () => {
      this.edit();
    });
  }
}
```

### Return Value is jQuery

`this.$sid()` returns a jQuery object:

```javascript
on_ready() {
  const title = this.$sid('title');  // jQuery object

  // All jQuery methods work
  title.text('New Title');
  title.addClass('highlight');
  title.fadeIn();

  // jQuery chaining
  this.$sid('button')
    .addClass('btn-primary')
    .on('click', this.handle_click)
    .fadeIn(300);
}
```

## jQuery .component() Method

### Getter and Setter Modes

JQHTML adds `.component()` method to jQuery with two modes:

**Getter mode (no arguments)** - Returns component instance:

```javascript
// Get existing component instance from jQuery object
const component = $('#user-card').component();

// Access component properties
console.log(component.data);
console.log(component.args);

// Call lifecycle manipulation methods
component.render();            // Re-render with current data
component.reload();            // Re-fetch data and update
component.stop();              // Stop lifecycle

// Call custom component methods
component.update_theme('dark');
```

**Setter mode (with arguments)** - Creates component, returns jQuery object:

```javascript
// Create new component programmatically
$('#container').component('UserCard', {user_id: 123});

// Returns jQuery object for chaining
$('<div>')
  .component('Dashboard', {theme: 'dark'})
  .appendTo('body')
  .fadeIn(300);

// Create and get instance in one line
const component = $('<div>')
  .component('UserCard', {user_id: 123})
  .appendTo('#container')
  .component();  // Getter mode after setter
```

**Key distinction:**
- `.component()` with no args → Returns **component instance**
- `.component('Name', args)` → Returns **jQuery object** (for chaining)

### Component Replacement Behavior

**When calling `.component('Name', args)` on an element that already has a component, the existing component is automatically replaced:**

```javascript
// Element has FirstComponent
$('#target').component('FirstComponent', {id: 1});

// Replace with SecondComponent
$('#target').component('SecondComponent', {id: 2});
```

**Replacement process:**

1. **Stop existing component** - Calls `.stop()` with try/catch error handling
2. **Remove component classes** - Strips all classes starting with capital letters
3. **Remove component data** - Cleans up `_component` data
4. **Create new component** - Instantiates and boots the new component

**Example - Dynamic component swapping:**

```javascript
class Dashboard extends Jqhtml_Component {
  on_ready() {
    // Initially show list view
    this.$sid('view_area').component('ListView', {
      items: this.data.items
    });

    // Switch to grid view on button click
    this.$sid('toggle_view').on('click', () => {
      this.$sid('view_area').component('GridView', {
        items: this.data.items
      });
      // Old ListView component is automatically stopped and cleaned up
    });
  }
}
```

**Class removal logic:**

Only classes starting with capital letters are removed (component classes), with one exception - BEM-style classes containing double underscores (`__`) are always preserved:

- `FirstComponent` → REMOVED
- `Component` → REMOVED
- `MyComponent__header` → KEPT (BEM class)
- `Card__footer` → KEPT (BEM class)
- `my-custom-class` → KEPT
- `active` → KEPT

**Error handling:**

The `stop()` call is wrapped in try/catch to ensure replacement continues even if the old component's cleanup fails:

```javascript
try {
  existingComponent.stop();
} catch (error) {
  console.warn('[JQHTML] Error stopping existing component during replacement:', error);
  // Continue with replacement anyway
}
```

**Use cases:**

- Dynamic view switching (list/grid/table)
- Tab content replacement
- Modal content swapping
- Form step progression
- Conditional component rendering based on state

**Important:** The old component's `on_stop()` lifecycle hook is called during `stop()`, allowing proper cleanup of timers, intervals, event listeners, etc.

### From Inside Component

```javascript
class ParentComponent extends Jqhtml_Component {
  on_ready() {
    // Access child component
    const child = this.$sid('child_card').component();

    // Interact with child
    child.update_data(new_data);
    console.log(child.data.user_name);
  }
}
```

### Check if Element is Component

```javascript
if ($element.hasClass('Component')) {
  const component = $element.component();
  console.log('Found component:', component.constructor.name);
}
```

## Overriding jQuery Methods

### Custom .val() Implementation

Components can override jQuery's `.val()` method:

```jqhtml
<Define:CustomInput>
  <div class="custom-input">
    <input $sid="input" type="text" />
    <span $sid="formatted"></span>
  </div>
</Define:CustomInput>
```

```javascript
class CustomInput extends Jqhtml_Component {
  val(value) {
    if (arguments.length === 0) {
      // Getter - return custom formatted value
      const raw = this.$sid('input').val();
      return this.format_value(raw);
    } else {
      // Setter - set with validation
      const validated = this.validate_value(value);
      this.$sid('input').val(validated);
      this.$sid('formatted').text(this.format_display(validated));
      return this.$;  // Return jQuery object for chaining
    }
  }

  format_value(value) {
    // Custom formatting logic
    return value.toUpperCase();
  }

  validate_value(value) {
    // Validation logic
    return value.replace(/[^a-z0-9]/gi, '');
  }

  format_display(value) {
    return `Value: ${value}`;
  }
}
```

**Usage:**

```javascript
// Getter
const value = $('#my-input').val();  // Returns formatted value

// Setter with chaining
$('#my-input')
  .val('hello123')
  .addClass('populated');
```

### Why Override .val()?

Custom input components (date pickers, masked inputs, formatted fields) can provide their own value handling while maintaining jQuery's API.

## JQHTML's Own jQuery Method Overrides

Besides `.val()` (which YOU can override per-component), JQHTML itself overrides several core jQuery prototype methods with framework-specific safety and cleanup logic. These overrides apply globally, everywhere jQuery is used - not just inside components. Understanding them prevents confusing runtime errors and unexpected child-component teardown.

### .empty() / .html() / .text() Auto-Stop Child Components

`.empty()` is overridden to recursively `stop()` any child components (elements with the `Component` class) before clearing their DOM. This ensures a child's `on_stop()` hook (if it defines one) runs and its `'stop'` event fires when a subtree is torn down - even via plain jQuery calls, not just `component.stop()`.

`.html(value)` and `.text(value)` (setter mode only - getters are untouched) call `.empty()` internally before writing the new content, so they inherit the same child-stopping behavior:

```javascript
class Panel extends Jqhtml_Component {
  on_ready() {
    // Any child components inside #content are automatically stopped
    // (on_stop() fires, 'stop' event fires) before the DOM is cleared
    this.$sid('content').empty();
    this.$sid('content').html('<p>New content</p>');
    this.$sid('content').text('Replaced');
  }
}
```

**Why this matters:** you don't need to manually walk child components and call `.stop()` before clearing a container - `.empty()`/`.html()`/`.text()` do it for you. But it also means these calls are not "free" DOM writes - they walk and stop every `.Component` descendant first.

### data-sid Is Not a Hand-Writable Attribute

`data-sid` is provisioned exclusively by the template renderer, which always pairs it with a scoped id (`"<sid>:<component_cid>"`). Because of this, JQHTML guards several jQuery entry points against misuse:

- **`.find(selector)`** throws if `selector` contains `[data-sid` (e.g. `this.$.find('[data-sid="btn"]')`). Use `this.$sid('btn')` / `this.sid('btn')` instead.
- **`.on(event, selector, handler)`** throws if the delegated `selector` argument contains `[data-sid` (e.g. `.on('click', '[data-sid="btn"]', handler)`).
- **`.append()`, `.prepend()`, `.before()`, `.after()`, `.replaceWith()`**, and **`$(...)` construction itself** throw if the HTML string being inserted contains a hand-written `data-sid` attribute that isn't paired with the expected scoped id (i.e. `data-sid` you typed yourself rather than one the renderer produced).

```javascript
// Throws - data-sid can't be used in a plain selector
this.$.find('[data-sid="btn"]');

// Throws - data-sid can't be hand-written into inserted HTML
this.$.append('<div data-sid="row"></div>');

// Correct - use $sid in the template and this.$sid()/this.sid() in JS
this.$sid('btn').on('click', handler);
```

If you just need to select or mark a plain element, use a `data-*` attribute or a BEM-style class instead of `data-sid`.

### .on() Warns When Lifecycle-Like Events Are Attached to a Component Root

Because components have their own `.on()` for lifecycle events (`ready`, `create`, `render`, `loaded`, `stop`), calling jQuery's `.on()` directly on a component's root element with a non-DOM event name logs a `console.warn` - it usually means you meant `component.on()` instead. (Exception: `load` never warns — jQuery treats it as a standard DOM event for windows/images, so it is on the framework's exempt list.)

```javascript
class UserCard extends Jqhtml_Component {
  on_ready() {
    // Warns: "jQuery .on('ready') called on <UserCard> root element.
    // You may have meant to use component.on() for lifecycle events..."
    this.$.on('ready', () => {});

    // No warning - 'click' is a standard DOM event
    this.$.on('click', () => {});
  }
}
```

Standard DOM events (`click`, `change`, `focus`, `submit`, `scroll`, etc.) never trigger this warning, regardless of which element they're attached to. The warning only fires for non-DOM-event names attached directly to an element carrying the `Component` class - it does not fire for the same event name on a non-component element or a component's descendant elements.

## Event Handling

**Important:** JQHTML has two event systems that serve different purposes:

1. **jQuery DOM events** (`this.$.on()`, `this.$.trigger()`) - Standard DOM events, used for click handlers, form events, jQuery plugins
2. **Component events** (`component.on()`, `this.trigger()`) - JQHTML's event system with fire-if-already-occurred behavior, used for lifecycle events and component communication

See `14_lifecycle_complete_specification.md` for full component event documentation.

### jQuery DOM Events

Use jQuery's `.on()` and `.trigger()` for standard DOM event handling:

```javascript
class ButtonComponent extends Jqhtml_Component {
  on_ready() {
    // DOM click event
    this.$.on('click', (e) => {
      console.log('Component clicked');
    });

    // Form submit event
    this.$sid('submit').on('click', (e) => {
      e.preventDefault();
      this.handle_submit();
    });

    // Custom DOM event for jQuery plugin integration
    // NOTE: 'refresh' is not a standard DOM event, so attaching it directly to
    // this.$ (the component root) logs a console.warn suggesting component.on()
    // instead - see "JQHTML's Own jQuery Method Overrides" above. Attach custom
    // DOM events to a child element instead if you want to avoid the warning.
    this.$.on('refresh', () => {
      this.reload();
    });
  }

  handle_submit() {
    console.log('Submitting');
  }
}
```

### Triggering jQuery DOM Events

```javascript
class UserCard extends Jqhtml_Component {
  async update_status(status) {
    await fetch(`/api/status/${status}`, { method: 'POST' });
    await this.reload();  // Re-fetch data

    // Trigger jQuery DOM event (for external listeners)
    this.$.trigger('status-changed', [status]);
  }
}

// External jQuery code can listen
$('#user-card').on('status-changed', (e, status) => {
  console.log('Status changed to:', status);
});
```

### When to Use Which

| Use Case | Event System |
|----------|--------------|
| Click, submit, change handlers | jQuery DOM events |
| jQuery plugin integration | jQuery DOM events |
| Waiting for component ready | Component events |
| Component-to-component communication | Component events |
| Events that need fire-if-already-occurred | Component events |

## jQuery Plugins Integration

### Using Plugins on Components

```javascript
class SortableList extends Jqhtml_Component {
  on_ready() {
    // Initialize jQuery UI sortable
    this.$sid('list').sortable({
      handle: '.handle',
      update: (event, ui) => {
        this.handle_reorder();
      }
    });
  }

  handle_reorder() {
    const order = this.$sid('list').sortable('toArray');
    console.log('New order:', order);
  }
}
```

### Datepicker Example

```javascript
class DateInput extends Jqhtml_Component {
  on_ready() {
    this.$sid('input').datepicker({
      dateFormat: 'yy-mm-dd',
      onSelect: (date) => {
        this.handle_date_select(date);
      }
    });
  }

  handle_date_select(date) {
    console.log('Selected:', date);
    this.$.trigger('date-selected', [date]);
  }
}
```

## Finding Components with jQuery

### Select All Components

```javascript
$('.Component').each(function() {
  const component = $(this).component();
  console.log(component.constructor.name);
});
```

### Find Specific Component Type

```javascript
// Find all UserCard components
$('.Component').each(function() {
  const component = $(this).component();
  if (component instanceof UserCard) {
    component.reload_data();
  }
});
```

### Within Specific Container

```javascript
$('#dashboard').find('.Component').each(function() {
  $(this).component().update_theme('dark');
});
```

### shallowFind() - Find Direct Children Without Nested Descendants

JQHTML registers `shallowFind()` as a custom jQuery plugin method (alongside `.component()`). It's available on any jQuery object once JQHTML is loaded.

Standard jQuery `.find()` returns ALL descendants matching a selector, including elements nested inside other matches. This is problematic when working with component hierarchies - you often want to find child components without also finding their subcomponents.

**The problem:**

```html
<div class="Dashboard">
  <div class="Widget">              <!-- Want this -->
    <div class="Widget">            <!-- Don't want this (nested) -->
    </div>
  </div>
  <div class="Widget">              <!-- Want this -->
  </div>
</div>
```

```javascript
// find() returns ALL 3 widgets - including the nested one
this.$.find('.Widget')  // Returns 3 elements

// shallowFind() returns only the 2 direct children
this.$.shallowFind('.Widget')  // Returns 2 elements
```

**How it works:** `shallowFind()` traverses downward but stops when it finds a match - it does not recurse into matched elements.

**Use case - reload all child components:**

```javascript
class Dashboard extends Jqhtml_Component {
  async reload_widgets() {
    // Only reloads direct Widget children, not widgets nested inside other widgets
    this.$.shallowFind('.Widget').each(function() {
      $(this).component().reload();
    });
  }
}
```

**Use case - find direct child components of any type:**

```javascript
class Container extends Jqhtml_Component {
  get_child_components() {
    // Find all immediate child components without their subcomponents
    return this.$.shallowFind('.Component').map(function() {
      return $(this).component();
    }).get();
  }
}
```

**Comparison:**

| Method | Behavior |
|--------|----------|
| `.find(selector)` | Returns ALL descendants matching selector |
| `.children(selector)` | Returns only immediate children (one level deep) |
| `.shallowFind(selector)` | Returns nearest descendants, stops at matches |

`shallowFind()` is the "opposite of `.closest()`" - where `.closest()` searches upward and stops at the first match, `.shallowFind()` searches downward and stops at each match.

## jQuery Chaining

### Components Support Chaining

```javascript
class Card extends Jqhtml_Component {
  set_title(title) {
    this.$sid('title').text(title);
    return this.$;  // Enable chaining
  }

  set_theme(theme) {
    this.$.attr('data-theme', theme);
    return this.$;
  }
}

// Chaining
$('#card')
  .component()
  .set_title('New Title')
  .set_theme('dark')
  .addClass('active')
  .fadeIn();
```

## Direct DOM Manipulation

### No Virtual DOM - Direct Access

```javascript
class ProductList extends Jqhtml_Component {
  on_ready() {
    // Direct manipulation
    this.$sid('list').empty();

    for (let product of this.data.products) {
      const item = $(`
        <div class="product">
          <h4>${product.name}</h4>
          <p>${product.price}</p>
        </div>
      `);

      this.$sid('list').append(item);
    }
  }
}
```

**This is the JQHTML philosophy**: Direct DOM manipulation via jQuery, no virtual DOM, no reconciliation.

**Note:** `.empty()`, `.html()`, and `.text()` are overridden by JQHTML to stop child components before clearing the DOM, and `.append()`/`.find()`/`.on()` guard against hand-written `data-sid` misuse - see [JQHTML's Own jQuery Method Overrides](#jqhtmls-own-jquery-method-overrides) above.

## Key Concepts

1. **this.$ is real jQuery** - Not a wrapper, genuine jQuery object
2. **All jQuery methods work** - addClass, fadeIn, on, etc.
3. **this.$sid() returns jQuery** - Scoped ID lookup
4. **.component() accesses instance** - jQuery method to get component
5. **Override .val() for custom inputs** - Maintain jQuery API
6. **No virtual DOM** - Direct DOM manipulation
7. **jQuery plugins work** - Datepickers, sortable, etc.
8. **Support chaining** - Return this.$ from methods
9. **Events via jQuery** - .on(), .trigger(), custom events
10. **Components have .Component class** - For selection

## Philosophy

Where React hides the DOM behind abstractions, JQHTML embraces it. The DOM is efficient, jQuery is proven, and `$('#status').text('Updated')` is already reactive - just honest about it.
