# $ Attribute System and Scoped IDs

## Overview

The `$` prefix in JQHTML provides special attribute handling for data attributes, scoped IDs, and event binding. It's a shorthand system that makes component templates cleaner and more powerful.

## $ Prefix = Special Handling

Any attribute starting with `$` gets special treatment during compilation.

## $sid - Component-Scoped IDs

### Basic Usage

```jqhtml
<Define:UserCard>
  <div>
    <h3 $sid="title">User Name</h3>
    <button $sid="edit_btn">Edit</button>
  </div>
</Define:UserCard>
```

### How It Works

`$sid="name"` becomes `id="name:_cid"` where `_cid` is the component's unique ID.

**Rendered HTML:**
```html
<div class="Component">
  <h3 id="title:c123" data-sid="title">User Name</h3>
  <button id="edit_btn:c123" data-sid="edit_btn">Edit</button>
</div>
```

### Accessing Scoped IDs

Use `this.$sid(name)` to access:

```javascript
class UserCard extends Jqhtml_Component {
  on_ready() {
    // Access scoped ID
    this.$sid('title').text('John Doe');
    this.$sid('edit_btn').on('click', () => {
      this.edit();
    });
  }

  edit() {
    const title = this.$sid('title').text();
    console.log('Editing:', title);
  }
}
```

### Why Scoped IDs?

Multiple instances of the same component need unique IDs:

```jqhtml
<!-- Two instances, no ID conflicts -->
<UserCard $user_id="1" />
<UserCard $user_id="2" />

<!-- Each gets unique IDs: title:c1, title:c2, etc. -->
```

## $redrawable - Selective Re-rendering

### Basic Usage

Make any HTML element redrawable without defining a separate named component:

```jqhtml
<Define:Dashboard>
  <div $redrawable $sid="counter" class="badge badge-primary">
    Count: <%= this.data.count %>
  </div>
  <button @click=this.increment>+1</button>
</Define:Dashboard>
```

### How It Works

1. Parser transforms `$redrawable` elements into internal `<Redrawable>` components
2. Element gets a scoped ID (via `$sid`) that can be targeted for re-rendering
3. Call `this.render('sid_name')` to re-render only that element

**With `on_load()` (recommended for caching benefits):**

```javascript
class Dashboard extends Jqhtml_Component {
  async on_load() {
    this.data.count = await fetch('/api/count').then(r => r.json());
  }

  async increment() {
    await fetch('/api/count/increment', { method: 'POST' });
    await this.reload();  // Re-fetches data via on_load(), enables caching
  }
}
```

**Simple UI state (no data loading):**

```jqhtml
<Define:SimpleCounter>
  <div $redrawable $sid="display">Count: <%= this.args.count %></div>
  <button @click=this.increment>+1</button>
</Define:SimpleCounter>
```

```javascript
class SimpleCounter extends Jqhtml_Component {
  on_create() {
    this.args.count = this.args.count || 0;
  }

  increment() {
    this.args.count++;
    this.render('display');  // Template reads this.args.count directly
  }
}
```

To re-render just the target element: `this.render('sid_name')`. The rest of the component's DOM remains untouched.

### When to Use

- Counters, badges, live data displays
- Form validation messages
- Any element that changes independently of its parent
- When defining a named component feels like overkill

### Important Notes

- `$redrawable` requires `$sid` - the scoped ID is how you target the element for re-rendering
- `$redrawable` still creates a component internally - it just doesn't require a named component class
- Performance benefit: Only the targeted element's DOM is updated

## $attribute - jQuery .data() Storage

### Basic Usage

Any `$` attribute (except `$sid`) is stored via jQuery's `.data()` method:

```jqhtml
<Define:ProductCard>
  <div $product_id="<%= this.args.id %>" $category="<%= this.data.category %>">
    Product content
  </div>
</Define:ProductCard>
```

**Important:** `$` attributes are stored in jQuery's `.data()` but do NOT create `data-*` attributes on the rendered HTML element.

**Rendered HTML:**
```html
<div>
  Product content
</div>
```

### Accessing $ Attributes

Use jQuery's `.data()` method:

```javascript
class ProductCard extends Jqhtml_Component {
  on_ready() {
    const product_id = this.$.data('product_id');
    const category = this.$.data('category');
  }
}
```

**Note:** Use the original name without hyphens when accessing via `.data()` (e.g., `'product_id'` not `'product-id'`).

## $ Attribute Value Syntax

### Quoted Strings = Literal

```jqhtml
<UserCard $title="User Profile" />
<!-- this.args.title = "User Profile" -->
```

### String Interpolation

```jqhtml
<UserCard $title="User: <%= this.data.user_name %>" />
<!-- this.args.title = "User: " + this.data.user_name (raw JS string, NOT HTML-escaped) -->
```

**Important:** Unlike `<%= %>` inside template content, interpolation inside a `$attr="..."` value is built as a plain JavaScript string concatenation - it is **not** passed through `escape_html()`. If the interpolated value is later rendered into the DOM via `<%= %>` in a template body, it is escaped at that point, not when it was assigned to `this.args`.

### Unquoted = Restricted JavaScript Expression

Unquoted values are **not** arbitrary JavaScript expressions - they are restricted to a narrow grammar: literals, identifiers, property chains, and function/method calls (optionally prefixed with `!`).

```jqhtml
<!-- Numbers -->
<Counter $max=100 />
<!-- this.args.max = 100 (number) -->

<!-- Booleans -->
<Toggle $enabled=true />
<!-- this.args.enabled = true (boolean) -->

<!-- Objects -->
<Card $user=this.data.user />
<!-- this.args.user = {user object} -->

<!-- Function references -->
<ProductCard $on_delete=this.handle_delete />
<!-- this.args.on_delete = function reference -->

<!-- Function calls -->
<ProductCard $max=get_max('name') />
<!-- this.args.max = return value of get_max('name') -->
```

**Allowed patterns**: literals (`true`, `false`, `null`, `undefined`, numbers), identifiers, property chains (`obj.prop.subprop`), and function/method calls (`func()`, `obj.method(arg1, arg2)`), optionally negated with a leading `!`.

**NOT allowed - these throw a compile error, even with zero spaces**:
- Operators: `+`, `-` (except a leading `-` for negative numbers), `*`, `/`, `%`, `<`, `>`, `!=`, `&&`, `||`, etc. - e.g. `$val=this.data.a+this.data.b` fails to compile
- Ternaries and comparisons - e.g. `$val=this.data.active?'on':'off'` fails to compile
- Object literals (`{...}`) and array literals (`[...]`)

**Restrictions on what IS allowed**:
- **No spaces allowed** - Parser terminates at first space. `$id=get_id(user,true)` works, `$id=get_id(user, true)` does not.
- **Synchronous only** - Expressions evaluate during template rendering. No `await` or async operations.

**Escape hatch - parenthesized expressions**: Wrapping the value in parentheses allows a fuller JavaScript expression, including operators, ternaries, and comparisons, and even tolerates internal spaces:

```jqhtml
<Toggle $status=(this.data.active ? 'online' : 'offline') />
<Card $total=(this.data.a + this.data.b) />
```

This form is unquoted (no surrounding `"..."`) but everything between the outer parentheses is parsed and emitted as-is, so ordinary spaces and operators inside it are fine.

## @ Event Binding

**Note**: JQHTML uses `@` prefix for event binding, not `$on*` attributes.

### Event Handler Attributes

```jqhtml
<Define:ButtonComponent>
  <button @click=this.handle_click>
    Click Me
  </button>
</Define:ButtonComponent>
```

```javascript
class ButtonComponent extends Jqhtml_Component {
  handle_click(event) {
    console.log('Button clicked');
  }
}
```

### Multiple Event Types

```jqhtml
<input
  @change=this.handle_change
  @focus=this.handle_focus
  @blur=this.handle_blur
/>
```

**Common events**: @click, @change, @submit, @focus, @blur, @keyup, @keydown, @mouseover, @mouseout

**See**: `01_template_syntax.md` for complete event binding documentation.

## Passing Arguments to Components

### Basic Arguments

```jqhtml
<Define:UserList>
  <div>
    <% for (let user of this.data.users) { %>
      <UserCard
        $user_id=user.id
        $name="<%= user.name %>"
        $theme="light"
      />
    <% } %>
  </div>
</Define:UserList>
```

### Accessing in Child Component

```javascript
class UserCard extends Jqhtml_Component {
  on_create() {
    console.log(this.args.user_id);  // From $user_id
    console.log(this.args.name);     // From $name
    console.log(this.args.theme);    // From $theme
  }
}
```

## Complex Example

```jqhtml
<Define:ProductGrid>
  <div class="grid">
    <% for (let product of this.data.products) { %>
      <ProductCard
        $product_id=product.id
        $name="<%= product.name %>"
        $price="<%= product.price %>"
        $category="<%= product.category %>"
        $featured=product.featured
      />
    <% } %>
  </div>
</Define:ProductGrid>

<Define:ProductCard>
  <div class="card" $sid="card" $product_id="<%= this.args.product_id %>">
    <h3 $sid="title"><%= this.args.name %></h3>
    <p $sid="price">$<%= this.args.price %></p>
    <button $sid="buy" @click=this.buy>Buy Now</button>
  </div>
</Define:ProductCard>
```

```javascript
class ProductCard extends Jqhtml_Component {
  on_ready() {
    if (this.args.featured) {
      this.$sid('card').addClass('featured');
    }
  }

  buy() {
    const product_id = this.args.product_id;
    const name = this.$sid('title').text();
    console.log('Buying:', name, product_id);
  }
}
```

## Key Concepts

1. **$sid = scoped IDs** - Unique per component instance
2. **$redrawable = selective re-rendering** - Re-render elements without defining a component
3. **$attribute = jQuery .data() storage** - Stored via jQuery, not as DOM attributes
4. **Quoted = string literal** - "value" or with <%= interpolation %>
5. **Unquoted = expression** - Raw JS values (no spaces, synchronous only)
6. **@ = event binding** - Use @click, @change, etc. (not $onclick)
7. **Access with this.$sid()** - Method for scoped ID lookup
8. **Access with .data()** - jQuery method for $ attribute values
9. **this.args contains all** - All $ attributes passed to component
