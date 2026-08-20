# Scoped IDs & Element Access

The `$sid` attribute provides component-scoped IDs that prevent conflicts between multiple instances. Access these elements with `this.$sid()`.

## The Problem

Regular IDs conflict when multiple component instances exist:

```jqhtml
<Define:UserCard>
  <h3 id="title">Name</h3>  <!-- Conflict! -->
</Define:UserCard>

<!-- Three instances = three elements with id="title" -->
<UserCard $user_id="1" />
<UserCard $user_id="2" />
<UserCard $user_id="3" />
```

## The Solution: $sid

Use `$sid` instead of `id`:

```jqhtml
<Define:UserCard>
  <h3 $sid="title">Name</h3>
  <p $sid="email">Email</p>
  <button $sid="edit">Edit</button>
</Define:UserCard>
```

**Rendered:**

```html
<div class="UserCard Component" data-cid="c123">
  <h3 id="title:c123" data-sid="title">Name</h3>
  <p id="email:c123" data-sid="email">Email</p>
  <button id="edit:c123" data-sid="edit">Edit</button>
</div>
```

Each instance gets unique IDs: `title:c123`, `title:c456`, `title:c789`.

The `data-sid` and `data-cid` attributes are debug mirrors for reading the DOM in DevTools.
They are absent when jqhtml runs in production mode, and nothing resolves through them — the
scoped `id` does the work. Never write selectors against them.

## Accessing Elements: this.$sid()

Access scoped elements with `this.$sid()`:

```javascript
class UserCard extends Jqhtml_Component {
  on_ready() {
    // Returns jQuery object
    this.$sid('title').text('John Doe');
    this.$sid('email').text('john@example.com');

    // Event binding
    this.$sid('edit').on('click', () => this.edit());
  }
}
```

**Never construct the full ID manually**:

```javascript
// Wrong
$('#title:c123').text('Name');

// Correct
this.$sid('title').text('Name');
```

## jQuery Methods

`this.$sid()` returns a jQuery object. All jQuery methods work:

```javascript
this.$sid('title').text('New Title');
this.$sid('image').attr('src', 'photo.jpg');
this.$sid('panel').addClass('active');
this.$sid('content').fadeIn(300);
this.$sid('form').on('submit', handler);

// Chaining
this.$sid('badge')
  .text('New')
  .addClass('badge-success')
  .fadeIn();
```

## Common Patterns

### Form Input Access

```jqhtml
<Define:LoginForm>
  <form $sid="form">
    <input $sid="username" type="text" />
    <input $sid="password" type="password" />
    <button $sid="submit">Login</button>
  </form>
</Define:LoginForm>
```

```javascript
class LoginForm extends Jqhtml_Component {
  on_ready() {
    this.$sid('form').on('submit', (e) => {
      e.preventDefault();
      const username = this.$sid('username').val();
      const password = this.$sid('password').val();
      this.submit(username, password);
    });
  }
}
```

### Dynamic Updates

```jqhtml
<Define:StatusWidget>
  <span $sid="label">Offline</span>
  <span $sid="time">--</span>
</Define:StatusWidget>
```

```javascript
class StatusWidget extends Jqhtml_Component {
  update_status(status, time) {
    this.$sid('label').text(status);
    this.$sid('time').text(time);
  }
}
```

### Image Loading

```jqhtml
<Define:ProductCard>
  <img $sid="image" src="" alt="" />
  <h3 $sid="name"></h3>
</Define:ProductCard>
```

```javascript
class ProductCard extends Jqhtml_Component {
  on_ready() {
    this.$sid('image').attr('src', this.data.image_url);
    this.$sid('image').attr('alt', this.data.name);
    this.$sid('name').text(this.data.name);
  }
}
```

## Accessing Child Components

`$sid` also works on child components. Use `.component()` to get the instance:

```jqhtml
<Define:Dashboard>
  <ChartWidget $sid="chart" />
  <StatsPanel $sid="stats" />
</Define:Dashboard>
```

```javascript
class Dashboard extends Jqhtml_Component {
  on_ready() {
    // Get child component instances
    const chart = this.$sid('chart').component();
    const stats = this.$sid('stats').component();

    // Call their methods
    chart.render_data(this.data.sales);
    stats.update(this.data.metrics);
  }
}
```

## this.sid() for Component Instances

Use `this.sid()` (without `$`) to get a child component instance directly:

```javascript
// These are equivalent:
const chart = this.$sid('chart').component();
const chart = this.sid('chart');
```

## Selective Re-rendering with $redrawable

For elements you want to re-render independently without defining a separate component, add `$redrawable` alongside `$sid`:

```jqhtml
<Define:Dashboard>
  <div $redrawable $sid="counter" class="badge">
    Count: <%= this.data.count %>
  </div>
  <button @click=this.increment>+1</button>
</Define:Dashboard>
```

```javascript
class Dashboard extends Jqhtml_Component {
  async on_load() {
    this.data.count = await fetch('/api/count').then(r => r.json());
  }

  async increment() {
    await fetch('/api/count/increment', { method: 'POST' });
    await this.reload();
  }
}
```

To re-render just that element, call `this.render('counter')`. The rest of the component's DOM remains untouched.

This is useful when:
- You have a small piece of data-driven markup inside a larger template
- Creating a named component feels like overkill
- You want to keep the markup inline for readability

## Other Element Access Methods

### this.$.find()

Find descendants within the component:

```javascript
// Find all images
const images = this.$.find('img');

// Find all child components of a type
const buttons = this.$.find('.ButtonComponent');
buttons.each(function() {
  $(this).component().disable();
});
```

### this.$.closest()

Find ancestors:

```javascript
// Find parent form
const form = this.$.closest('form');

// Find parent component
const parent = this.$.closest('.ParentComponent').component();
```

### this.$.siblings()

Find siblings:

```javascript
// Deactivate sibling tabs
this.$.siblings('.Tab').removeClass('active');
this.$.addClass('active');
```

## Performance Tips

### Cache References

Cache elements accessed multiple times:

```javascript
on_ready() {
  // Cache once
  const counter = this.$sid('counter');

  // Reuse
  setInterval(() => {
    const value = parseInt(counter.text()) + 1;
    counter.text(value);
  }, 1000);
}
```

### Use find() for Multiple Elements

```javascript
// Better: single traversal
this.$.find('tr').addClass('table-row');

// Worse: multiple lookups
this.$sid('row1').addClass('table-row');
this.$sid('row2').addClass('table-row');
```

## Summary

| Method | Returns | Use For |
|--------|---------|---------|
| `this.$sid('name')` | jQuery object | Template elements |
| `this.sid('name')` | Component instance | Child components |
| `this.$.find()` | jQuery object | Descendant search |
| `this.$.closest()` | jQuery object | Ancestor search |

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/reference/03_dollar_attribute_system.md` - $sid attribute syntax
- `docs/reference/13_scoped_ids_and_element_access.md` - Complete element access guide

### Last Updated
2026-08-19

### Editorial Notes
- 2026-08-19: Noted that `data-sid`/`data-cid` in the rendered example are debug mirrors absent
  in production. The example is development-accurate, but without the note a reader would
  reasonably assume the attributes are stable API and write selectors against them.
- Focused on the practical "how to use" over internal mechanisms
- Showed common patterns: forms, dynamic updates, images
- this.sid() vs this.$sid() distinction important
- Performance tips included since they're practical
- Omitted component ID generation details - too internal
- 2026-07-21: Accuracy pass - "Rendered" example now includes the `data-sid` attribute that every `$sid` element actually renders with, alongside the scoped `id`. Corrected `JqhtmlComponent` references to `Jqhtml_Component`.
