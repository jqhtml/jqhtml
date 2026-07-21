# Scoped IDs and Element Access in Components

## Overview

The `this.$sid()` method is the **preferred way** to access elements defined in a component's template. It provides component-scoped IDs that prevent conflicts between multiple instances.

## The Problem: ID Conflicts

Without scoping, multiple component instances would have ID conflicts:

```jqhtml
<Define:UserCard>
  <div>
    <h3 id="title">Name</h3>  <!-- ❌ Conflict if multiple instances -->
    <p id="email">Email</p>
  </div>
</Define:UserCard>

<!-- Multiple instances = duplicate IDs -->
<UserCard $user_id="1" />
<UserCard $user_id="2" />
<UserCard $user_id="3" />
```

**Problem**: Three elements with `id="title"`, three with `id="email"` - invalid HTML.

## The Solution: $sid Attribute

Use `$sid` instead of `id` to get component-scoped IDs:

```jqhtml
<Define:UserCard>
  <div>
    <h3 $sid="title">Name</h3>
    <p $sid="email">Email</p>
  </div>
</Define:UserCard>
```

**Note**: `$sid` can only be used on descendant elements/components within the template body - not on the `<Define:...>` tag itself. Component definitions cannot have scoped IDs (the compiler throws a syntax error: `$sid is not allowed in <Define:> tags. Component definitions cannot have scoped IDs.`).

**Rendered HTML** (for three instances):
```html
<!-- Instance 1 -->
<div class="UserCard Component" data-cid="c123">
  <h3 id="title:c123">Name</h3>
  <p id="email:c123">Email</p>
</div>

<!-- Instance 2 -->
<div class="UserCard Component" data-cid="c456">
  <h3 id="title:c456">Name</h3>
  <p id="email:c456">Email</p>
</div>

<!-- Instance 3 -->
<div class="UserCard Component" data-cid="c789">
  <h3 id="title:c789">Name</h3>
  <p id="email:c789">Email</p>
</div>
```

**ID Format**: `original_name:component_id`

**Component ID Generation**: Each component instance gets a unique `_cid` (component ID), assigned once at construction time from a monotonically increasing counter shared across the page. This value is **stable for the life of that instance** (it never changes across re-renders), and unique between instances - but it is not derived from the component's DOM position or parent context.

## Accessing Scoped IDs with this.$sid()

### Basic Usage

**Never use the full scoped ID directly** - always use `this.$sid()`:

```javascript
class UserCard extends Jqhtml_Component {
  on_ready() {
    // ✅ CORRECT - Use logical name
    this.$sid('title').text('John Doe');
    this.$sid('email').text('john@example.com');

    // ❌ WRONG - Don't construct full ID manually
    $('#title:c123').text('John Doe');  // Fragile, breaks
  }
}
```

### Do Not Hand-Write data-sid

**Never hand-author `data-sid` via jQuery HTML-injection methods.** `data-sid` is provisioned only by the jqhtml template renderer, which always pairs it with a scoped id (`"<sid>:<component_cid>"`) that binds the element to its component. An element you create yourself (e.g. via `.html()`, `.append()`, `.prepend()`, `.before()`, `.after()`, `.replaceWith()`, or `$('<div data-sid="x">')` construction) has no such scoped id, so `this.$sid()` / `this.sid()` can never find it.

```javascript
// ❌ WRONG - throws an error
this.$.append('<div data-sid="foo"></div>');
// [JQHTML] Manually creating an element with data-sid="foo" via jQuery (...) is not allowed.
```

If you only need to select or mark a plain element, use a normal `data-*` attribute or class instead of `data-sid`. See `packages/core/src/jquery-plugin.ts` for the guard implementation.

### Why this.$sid() Works

`this.$sid('title')` automatically constructs the full scoped ID and returns the jQuery element:

```javascript
// What this.$sid('title') does internally:
const full_id = 'title:' + this.component_id;  // "title:c123"
return $('#' + full_id);  // jQuery element
```

**You get**: jQuery object for the element, properly scoped to this instance.

## this.$sid() Returns jQuery

The return value is a **jQuery object**, so all jQuery methods work:

```javascript
class ProductCard extends Jqhtml_Component {
  on_ready() {
    // jQuery methods available immediately
    this.$sid('title').text('Product Name');
    this.$sid('price').html('<strong>$99.99</strong>');
    this.$sid('image').attr('src', 'product.jpg');
    this.$sid('button').addClass('btn-primary');
    this.$sid('description').fadeIn(300);

    // jQuery chaining
    this.$sid('badge')
      .text('New')
      .addClass('badge-success')
      .fadeIn();

    // Event binding
    this.$sid('buy_button').on('click', () => {
      this.handle_purchase();
    });
  }
}
```

## Common Use Cases

### 1. Updating Text Content

```jqhtml
<Define:StatusWidget>
  <div class="status">
    <span $sid="status_label">Offline</span>
    <span $sid="status_time">--</span>
  </div>
</Define:StatusWidget>
```

```javascript
class StatusWidget extends Jqhtml_Component {
  update_status(status, time) {
    this.$sid('status_label').text(status);
    this.$sid('status_time').text(time);
  }

  on_ready() {
    this.update_status('Online', '2 minutes ago');
  }
}
```

### 2. Changing Images

```jqhtml
<Define:ProductCard>
  <div class="product">
    <img $sid="product_image" src="" alt="Product" />
    <h3 $sid="product_name"></h3>
  </div>
</Define:ProductCard>
```

```javascript
class ProductCard extends Jqhtml_Component {
  async on_load() {
    this.data = await fetch(`/api/products/${this.args.product_id}`)
      .then(r => r.json());
  }

  on_ready() {
    // Update image src
    this.$sid('product_image').attr('src', this.data.image_url);
    this.$sid('product_image').attr('alt', this.data.name);

    // Update name
    this.$sid('product_name').text(this.data.name);
  }
}
```

### 3. Form Input Access

```jqhtml
<Define:LoginForm>
  <form $sid="form">
    <input $sid="username" type="text" placeholder="Username" />
    <input $sid="password" type="password" placeholder="Password" />
    <button $sid="submit" type="submit">Login</button>
  </form>
</Define:LoginForm>
```

```javascript
class LoginForm extends Jqhtml_Component {
  on_ready() {
    this.$sid('form').on('submit', (e) => {
      e.preventDefault();
      this.handle_submit();
    });
  }

  handle_submit() {
    const username = this.$sid('username').val();
    const password = this.$sid('password').val();

    console.log('Submitting:', username, password);
  }

  clear_form() {
    this.$sid('username').val('');
    this.$sid('password').val('');
  }
}
```

### 4. Accessing Nested Components

```jqhtml
<Define:UserProfile>
  <div>
    <h2 $sid="name"></h2>
    <AvatarComponent $sid="avatar" />
    <StatsWidget $sid="stats" />
  </div>
</Define:UserProfile>
```

```javascript
class UserProfile extends Jqhtml_Component {
  on_ready() {
    // Access text element
    this.$sid('name').text(this.data.user.name);

    // Access nested components via .component()
    const avatar = this.$sid('avatar').component();
    avatar.set_image(this.data.user.avatar_url);

    const stats = this.$sid('stats').component();
    stats.update_stats(this.data.user.stats);
  }
}
```

### Shortcut: this.sid()

`this.$sid(name).component()` is such a common pattern that there's a direct shortcut: `this.sid(name)`. It finds the element by scoped ID and returns the component instance directly (or `null` if not found or not a component):

```javascript
class UserProfile extends Jqhtml_Component {
  on_ready() {
    // Equivalent to this.$sid('avatar').component()
    const avatar = this.sid('avatar');
    avatar.set_image(this.data.user.avatar_url);

    const stats = this.sid('stats');
    stats.update_stats(this.data.user.stats);
  }
}
```

**Note**: If the element exists but isn't a component or `$redrawable`, `this.sid()` logs a console warning (likely a missing `$redrawable`) and returns `null`.

## Scoped IDs for Elements AND Components

`$sid` works for both regular HTML elements and components:

### Regular Elements

```jqhtml
<Define:Card>
  <div $sid="container" class="card">
    <h3 $sid="title"></h3>
    <p $sid="content"></p>
    <img $sid="image" />
    <button $sid="action">Action</button>
  </div>
</Define:Card>
```

```javascript
class Card extends Jqhtml_Component {
  on_ready() {
    this.$sid('container').addClass('loaded');
    this.$sid('title').text('Title');
    this.$sid('content').html('<strong>Content</strong>');
    this.$sid('image').attr('src', 'image.jpg');
    this.$sid('action').on('click', () => this.handle_action());
  }
}
```

### Components

```jqhtml
<Define:Dashboard>
  <div>
    <HeaderComponent $sid="header" />
    <ChartComponent $sid="chart" />
    <FooterComponent $sid="footer" />
  </div>
</Define:Dashboard>
```

```javascript
class Dashboard extends Jqhtml_Component {
  on_ready() {
    // Access component instances (this.sid() is shorthand for this.$sid(x).component())
    const header = this.sid('header');
    const chart = this.sid('chart');
    const footer = this.sid('footer');

    // Call component methods
    header.set_title('Sales Dashboard');
    chart.render_data(this.data.sales);
    footer.set_timestamp(new Date());
  }
}
```

## Other Element Access Methods

### Do Not Use [data-sid=...] as a Raw Selector

`data-sid` is for DevTools debugging only (it may be disabled in production) and must never be used as a CSS selector fragment. Both `.find()` and `.on()`'s delegated-selector argument throw if the selector contains `[data-sid`:

```javascript
// ❌ WRONG - both throw [JQHTML] errors
this.$.find('[data-sid="btn"]');
this.$.on('click', '[data-sid="btn"]', handler);

// ✅ CORRECT - use the scoped-ID accessors
this.$sid('btn');
this.$sid('btn').on('click', handler);
```

Use `this.$sid('name')` / `this.sid('name')` instead, or fall back to a plain `data-*` attribute or BEM-style class for non-scoped selection.

### this.$.find() - Find Descendant Elements

Since `this.$` is a jQuery object for the component root, you can use `.find()`:

```javascript
class ImageGallery extends Jqhtml_Component {
  on_ready() {
    // Find all img tags within this component
    const images = this.$.find('img');
    images.each(function() {
      console.log('Image src:', $(this).attr('src'));
    });

    // Find all components of specific type
    const radio_buttons = this.$.find('.RadioComponent');
    radio_buttons.each(function() {
      const component = $(this).component();
      component.disable();
    });
  }

  set_all_images_width(width) {
    this.$.find('img').css('width', width + 'px');
  }

  get_all_radios() {
    return this.$.find('.RadioComponent').map(function() {
      return $(this).component();
    }).get();
  }
}
```

### this.$.closest() - Find Ancestor Elements

Navigate up the DOM tree:

```javascript
class NestedComponent extends Jqhtml_Component {
  on_ready() {
    // Find nearest parent LayoutComponent
    const layout = this.$.closest('.LayoutComponent');
    if (layout.length) {
      const layout_component = layout.component();
      console.log('Found parent layout:', layout_component);
    }

    // Find nearest form
    const form = this.$.closest('form');
    if (form.length) {
      form.on('submit', () => {
        console.log('Form submitted');
      });
    }
  }
}
```

### this.$.parent() - Direct Parent

```javascript
class ListItem extends Jqhtml_Component {
  on_ready() {
    // Get direct parent element
    const parent = this.$.parent();
    parent.addClass('has-items');

    // Check if parent is a component
    if (parent.hasClass('Component')) {
      const parent_component = parent.component();
      console.log('Parent component:', parent_component.constructor.name);
    }
  }
}
```

### this.$.siblings() - Sibling Elements

```javascript
class Tab extends Jqhtml_Component {
  on_ready() {
    this.$.on('click', () => {
      // Deactivate all sibling tabs
      this.$.siblings('.Tab').each(function() {
        $(this).component().deactivate();
      });

      // Activate this tab
      this.activate();
    });
  }

  activate() {
    this.$.addClass('active');
  }

  deactivate() {
    this.$.removeClass('active');
  }
}
```

## Practical Examples

### Image Gallery Component

```jqhtml
<Define:ImageGallery>
  <div class="gallery">
    <div $sid="main_image_container">
      <img $sid="main_image" src="" />
    </div>
    <div $sid="thumbnails" class="thumbnails">
      <!-- Thumbnails inserted dynamically -->
    </div>
  </div>
</Define:ImageGallery>
```

```javascript
class ImageGallery extends Jqhtml_Component {
  async on_load() {
    this.data.images = await fetch(`/api/galleries/${this.args.gallery_id}`)
      .then(r => r.json());
  }

  on_ready() {
    // Set main image
    this.$sid('main_image').attr('src', this.data.images[0].url);

    // Create thumbnails
    const thumbnails = this.$sid('thumbnails');
    this.data.images.forEach((image, index) => {
      const thumb = $(`<img src="${image.thumb_url}" />`);
      thumb.on('click', () => this.show_image(index));
      thumbnails.append(thumb);
    });

    // Find and style all images
    this.$.find('img').addClass('gallery-image');
  }

  show_image(index) {
    this.$sid('main_image')
      .fadeOut(150, () => {
        this.$sid('main_image')
          .attr('src', this.data.images[index].url)
          .fadeIn(150);
      });
  }
}
```

### Form with Dynamic Fields

```jqhtml
<Define:DynamicForm>
  <form $sid="form">
    <div $sid="fields_container">
      <!-- Fields added dynamically -->
    </div>
    <button $sid="add_field" type="button">Add Field</button>
    <button $sid="submit" type="submit">Submit</button>
  </form>
</Define:DynamicForm>
```

```javascript
class DynamicForm extends Jqhtml_Component {
  on_create() {
    this.field_count = 0;
  }

  on_ready() {
    this.$sid('add_field').on('click', () => this.add_field());
    this.$sid('form').on('submit', (e) => {
      e.preventDefault();
      this.handle_submit();
    });
  }

  add_field() {
    const field = $(`
      <div class="field">
        <input type="text" name="field_${this.field_count}" />
        <button type="button" class="remove">Remove</button>
      </div>
    `);

    field.find('.remove').on('click', () => field.remove());

    this.$sid('fields_container').append(field);
    this.field_count++;
  }

  handle_submit() {
    // Find all inputs within the form
    const values = {};
    this.$sid('form').find('input[type="text"]').each(function() {
      const name = $(this).attr('name');
      const value = $(this).val();
      values[name] = value;
    });

    console.log('Form values:', values);
  }
}
```

### Radio Group Component

```jqhtml
<Define:RadioGroup>
  <div class="radio-group">
    <div $sid="options_container">
      <!-- Radio options added dynamically -->
    </div>
  </div>
</Define:RadioGroup>
```

```javascript
class RadioGroup extends Jqhtml_Component {
  on_ready() {
    // Render radio options
    this.args.options.forEach((option, index) => {
      const radio = $(`
        <RadioComponent
          $sid="radio_${index}"
          $value="${option.value}"
          $label="${option.label}"
        />
      `);
      this.$sid('options_container').append(radio);
    });

    // Initialize all radio components
    // (They auto-initialize as JQHTML components)
  }

  get_selected_value() {
    // Find all RadioComponent children
    let selected_value = null;

    this.$.find('.RadioComponent').each(function() {
      const radio = $(this).component();
      if (radio.is_selected()) {
        selected_value = radio.args.value;
      }
    });

    return selected_value;
  }

  select_by_value(value) {
    this.$.find('.RadioComponent').each(function() {
      const radio = $(this).component();
      if (radio.args.value === value) {
        radio.select();
      } else {
        radio.deselect();
      }
    });
  }
}
```

## Performance Considerations

### Efficient ID Lookup

`this.$sid()` uses `getElementById` under the hood, which is **extremely fast**:

```javascript
// What happens:
const full_id = 'title:' + this.component_id;  // String concatenation
return $('#' + full_id);  // Uses getElementById internally
```

**Performance**: O(1) - constant time lookup.

### Cache References for Repeated Access

If accessing the same element many times in a method, cache it:

```javascript
class AnimationComponent extends Jqhtml_Component {
  on_ready() {
    // ❌ Inefficient - lookup every iteration
    for (let i = 0; i < 1000; i++) {
      this.$sid('counter').text(i);
    }

    // ✅ Efficient - lookup once, reuse
    const counter = this.$sid('counter');
    for (let i = 0; i < 1000; i++) {
      counter.text(i);
    }
  }
}
```

### Use .find() for Multiple Elements

When accessing multiple elements, `.find()` is more efficient:

```javascript
class TableComponent extends Jqhtml_Component {
  on_ready() {
    // ✅ Single traversal
    const rows = this.$.find('tr');
    rows.addClass('table-row');

    // ❌ Multiple traversals (if you had IDs on each)
    this.$sid('row1').addClass('table-row');
    this.$sid('row2').addClass('table-row');
    // ... etc
  }
}
```

## Key Concepts

1. **this.$sid('name') is the preferred way** to access template elements
2. **$sid in template** → scoped ID in DOM (`name:component_id`)
3. **Never construct full IDs manually** - always use `this.$sid()`
4. **Returns jQuery object** - all jQuery methods available
5. **Works for elements AND components** - use `.component()` to access component instance, or use `this.sid('name')` as a shortcut for `this.$sid('name').component()`
6. **this.$.find()** - find descendant elements/components
7. **this.$.closest()** - find ancestor elements/components
8. **this.$.siblings()** - find sibling elements
9. **Cache references** for repeated access
10. **Component-scoped** - prevents ID conflicts between instances

## Summary

The scoped ID system is fundamental to JQHTML's component architecture. It enables:
- Multiple component instances without ID conflicts
- Clean, readable element access in JavaScript
- Type-safe access to template elements
- jQuery's full power on component elements
- Efficient DOM traversal and manipulation
