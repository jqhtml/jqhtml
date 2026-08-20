# jQuery Integration

Every JQHTML component is bound to a single DOM element. From within the component, access the jQuery element via `this.$`. From jQuery, access the component via `$(selector).component()`. This two-way binding is the foundation of JQHTML's jQuery integration.

## this.$

Inside any component method, `this.$` is the jQuery element for the component's root DOM node. All standard jQuery methods work:

```javascript
class UserCard extends Jqhtml_Component {
  on_ready() {
    this.$.addClass('active');
    this.$.css('background', '#f0f0f0');
    this.$.attr('data-status', 'loaded');
  }
}
```

## Common jQuery Methods

For developers less familiar with jQuery, here are the methods you'll use most often:

| Method | Purpose | Example |
|--------|---------|---------|
| `.addClass(name)` | Add a CSS class | `this.$.addClass('highlighted')` |
| `.removeClass(name)` | Remove a CSS class | `this.$.removeClass('loading')` |
| `.toggleClass(name)` | Toggle a CSS class on/off | `this.$.toggleClass('expanded')` |
| `.css(prop, value)` | Set inline style | `this.$.css('opacity', '0.5')` |
| `.attr(name, value)` | Set an attribute | `this.$.attr('data-id', 123)` |
| `.submit()` | Submit a form | `this.$sid('form').submit()` |
| `.val()` | Get/set input value | `this.$sid('input').val()` |

## Finding Child Components

Use `this.$.find()` to locate child components by their class name (every component has its name as a CSS class):

```javascript
class Dashboard extends Jqhtml_Component {
  async reset_all_counters() {
    this.$.find('.Counter').each(function() {
      const component = $(this).component();
      if (!component) return;

      component.args.value = 0;
      component.reload();
    });
  }

  hide_all_alerts() {
    this.$.find('.Alert').hide();
  }
}
```

This pattern is useful when a parent needs to interact with multiple child components of the same type.

## shallowFind() - Direct Children Only

JQHTML adds `shallowFind()` to jQuery as a plugin method. It's available on any jQuery object once JQHTML is loaded.

Standard `.find()` returns ALL descendants, including components nested inside other components. When you want only direct child components (not their subcomponents), use `shallowFind()`:

```html
<div class="Dashboard">
  <div class="Widget">              <!-- Want this -->
    <div class="Widget">            <!-- Don't want (nested) -->
    </div>
  </div>
  <div class="Widget">              <!-- Want this -->
  </div>
</div>
```

```javascript
// find() returns all 3 widgets
this.$.find('.Widget')        // 3 elements

// shallowFind() returns only the 2 top-level ones
this.$.shallowFind('.Widget') // 2 elements
```

`shallowFind()` traverses downward but stops when it finds a match—it doesn't recurse into matched elements.

**Common use case—reload direct child components:**

```javascript
class Dashboard extends Jqhtml_Component {
  reload_children() {
    this.$.shallowFind('.Component').each(function() {
      $(this).component().reload();
    });
  }
}
```

| Method | Behavior |
|--------|----------|
| `.find(selector)` | All descendants matching selector |
| `.children(selector)` | Immediate children only (one level) |
| `.shallowFind(selector)` | Nearest descendants, stops at matches |

## Finding Parent Components

There are two ways to reach an ancestor. `this.$.closest()` is jQuery's, and walks up to the
nearest matching **element**:

```javascript
class ChildWidget extends Jqhtml_Component {
  notify_parent() {
    const parent = this.$.closest('.ParentDashboard').component();
    parent.handle_child_event();
  }
}
```

`this.closest()` is the component-level equivalent. It takes the same CSS selector but
returns the **component instance** directly, or `null` if there isn't one:

```javascript
const parent = this.closest('.ParentDashboard');
if (parent) parent.handle_child_event();
```

Three differences worth knowing:

| | `this.$.closest(sel)` | `this.closest(sel)` |
|-|---|---|
| Returns | jQuery object (possibly empty) | component instance, or `null` |
| Starts at | this component's own element | this component's **parent** — never matches itself |
| Non-component matches | returned as a plain element | skipped; the search keeps walking up |

That last row is the useful one. If a plain `<div class="ParentDashboard">` sits between the
child and the real component, the jQuery form stops there and `.component()` gives you
nothing, while `this.closest()` walks past it to the nearest actual component.

**However, reaching upward at all is discouraged.** Prefer passing callbacks from parent to child instead:

```javascript
// Better approach: parent passes callback to child
<ChildWidget $on_event=this.handle_child_event />
```

**Why avoid climbing to a parent (either form):**
- Breaks top-down data flow, making code harder to reason about
- Risk of circular dependencies
- Parent may not be ready when child accesses it—awaiting `parent.ready()` can deadlock if parent is also waiting for child

## The .component() Method

JQHTML adds `.component()` to jQuery for accessing component instances.

**Getter (no arguments)** — returns the component instance:

```javascript
const card = $('#user-card').component();
card.args.filter = 'active';
card.reload();
```

**Setter (with arguments)** — creates a component, returns jQuery for chaining:

```javascript
$('#container').component('UserCard', { user_id: 123 });
```

## Component Replacement

Calling `.component()` on an element that already has a component replaces it. The old component's `on_stop()` is called automatically:

```javascript
class ViewSwitcher extends Jqhtml_Component {
  on_ready() {
    this.$sid('toggle').on('click', () => {
      // Replace ListView with GridView
      this.$sid('view').component('GridView', { items: this.data.items });
    });
  }
}
```

During replacement, component classes (those starting with capital letters) are removed from the element. However, BEM-style classes containing `__` are preserved:

- `FirstComponent` → removed
- `MyComponent__header` → kept (BEM class)
- `active` → kept (lowercase)

## Custom .val() Hook

If a component defines a `val()` method, it automatically hooks into jQuery's `.val()`. This lets components behave like form inputs:

```javascript
class PhoneInput extends Jqhtml_Component {
  val(value) {
    if (arguments.length === 0) {
      // Getter: return cleaned value
      return this.$sid('input').val().replace(/\D/g, '');
    } else {
      // Setter: format and set
      const formatted = value.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
      this.$sid('input').val(formatted);
      return this.$;
    }
  }
}

// External code can use .val() normally
$('#phone').val('5551234567');  // Sets "(555) 123-4567"
$('#phone').val();              // Returns "5551234567"
```

## jQuery Plugin Integration

jQuery plugins work with JQHTML components:

```javascript
class SortableList extends Jqhtml_Component {
  on_ready() {
    this.$sid('list').sortable({
      handle: '.handle',
      update: () => this.save_order()
    });
  }
}
```

## Method Chaining

Return `this` from component methods to enable chaining:

```javascript
class Card extends Jqhtml_Component {
  set_title(title) {
    this.$sid('title').text(title);
    return this;
  }

  set_theme(theme) {
    this.$.attr('data-theme', theme);
    return this;
  }
}

const card = $('#card').component();
card.set_title('Hello').set_theme('dark');
```

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/reference/08_jquery_integration.md` - Complete jQuery integration guide

### Last Updated
2026-08-19

### Editorial Notes
- Rewritten to be more conversational with practical examples
- Focused on patterns developers actually use
- Added warnings about .closest() for parent access
- Explained .val() hook more clearly
- Removed generic jQuery method lists (append/prepend etc)
- Removed "Finding Components" section (redundant with find/closest examples)
- Added shallowFind() documentation (2025-11-26)
- Added note about BEM class preservation during component replacement (2025-12-26)
- 2026-08-19: Documented the component-level `this.closest(selector)` alongside jQuery's `this.$.closest()`. Only the jQuery form was covered, and the two are not interchangeable: the component form returns a component instance or `null`, starts at the parent (never matches itself), and skips ancestors that match the selector but carry no component. Reframed the existing caution to cover climbing to a parent by either route, since the objection is to the direction of the dependency, not to a particular method.
