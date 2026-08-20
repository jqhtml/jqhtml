# Component Parameters

Components receive parameters through `$` attributes. This chapter covers how to pass data to components and the different attribute types.

## The $ Attribute System

Attributes prefixed with `$` become component parameters accessible via `this.args`:

```jqhtml
<UserCard $user_id="123" $theme="dark" />
```

```javascript
class UserCard extends Jqhtml_Component {
  on_create() {
    console.log(this.args.user_id);  // "123"
    console.log(this.args.theme);    // "dark"
  }
}
```

Think of `$` attributes as function parameters:

```javascript
// Component invocation is like calling:
UserCard({ user_id: "123", theme: "dark" })
```

## Quoted vs Unquoted Values

This distinction is critical.

### Quoted = String Literal

```jqhtml
<Component $user_id="123" />
<!-- this.args.user_id = "123" (string) -->

<Component $label="Click me" />
<!-- this.args.label = "Click me" (string) -->
```

### Unquoted = JavaScript Expression

```jqhtml
<Component $user_id=123 />
<!-- this.args.user_id = 123 (number) -->

<Component $enabled=true />
<!-- this.args.enabled = true (boolean) -->

<Component $user=this.data.current_user />
<!-- this.args.user = {user object} -->

<Component $handler=this.on_click />
<!-- this.args.handler = function reference -->

<Component $max_length=MyModel.field_length('last_name') />
<!-- this.args.max_length = return value of function call -->

<Component $default=this.get_value('name') />
<!-- this.args.default = return value of method call -->
```

**Important restrictions:**

- **No spaces** in unquoted values. `$id=get_id(user,true)` works, `$id=get_id(user, true)` does not.
- **Negative numbers work**: `$offset=-1` or `$value=-45.67`
- **String arguments work** in function calls: `$val=func('arg')` or `$val=func("arg")`
- **Synchronous only.** Expressions evaluate during template rendering. No `await` or async operations.

### Practical Example

```jqhtml
<Define:UserList>
  <% for (let user of this.data.users) { %>
    <UserCard
      $user_id=user.id
      $user=user
      $theme="light"
      $can_edit=user.is_admin
    />
  <% } %>
</Define:UserList>
```

```javascript
class UserCard extends Jqhtml_Component {
  async on_load() {
    // Can use passed object or fetch by ID
    if (this.args.user) {
      this.data = this.args.user;
    } else {
      this.data = await fetch(`/api/users/${this.args.user_id}`)
        .then(r => r.json());
    }
  }

  on_ready() {
    if (this.args.can_edit) {
      this.$sid('edit_button').show();
    }
  }
}
```

## Attribute Types

JQHTML has several attribute types with different behaviors.

### $ Attributes (Component Parameters)

Pass data to components via `this.args`:

```jqhtml
<UserCard $user_id="123" />
```

### Plain HTML Attributes

Set directly on the DOM element:

```jqhtml
<UserCard style="color: red;" id="main-card" disabled />
```

Renders as:

```html
<div style="color: red;" id="main-card" disabled class="UserCard Component">
```

### @ Attributes (Events)

Bind DOM events (covered in [Event Handling](../11-event-handling/)):

```jqhtml
<button @click=this.handle_click>Click</button>
```

## Class Attribute Merging

The `class` attribute has special behavior: it **merges** rather than overrides.

### Sources Merged Together

1. Classes from `<Define>` tag
2. Classes from invocation
3. Component name (automatic)
4. Parent class names (from inheritance, if the class extends another component class)
5. `Component` (automatic, always last)

### Example

```jqhtml
<Define:Alert class="alert border">
  <%= content() %>
</Define:Alert>
```

```jqhtml
<Alert class="alert-danger shadow">Warning!</Alert>
```

Renders as:

```html
<div class="alert border alert-danger shadow Alert Component">
  Warning!
</div>
```

All classes combined. No duplicates.

## Attribute Precedence

**General rule:** Invocation attributes override Define attributes, except `class` and `style`, which merge.

### Define

```jqhtml
<Define:Panel style="padding: 10px; color: navy;" data-theme="light" class="panel">
  <%= content() %>
</Define:Panel>
```

### Invocation

```jqhtml
<Panel style="padding: 20px;" data-theme="dark" class="featured">
  Content
</Panel>
```

### Result

```html
<div
  style="padding: 20px; color: navy;"
  data-theme="dark"
  class="panel featured Panel Component">
  Content
</div>
```

- `style`: Merged property-by-property. `padding` conflicts, so invocation wins (`20px`). Define's non-conflicting `color: navy;` is preserved.
- `data-theme`: Invocation wins outright (`dark`) - plain attributes are a full override, not a merge
- `class`: Merged (`panel featured Panel Component`)

## Default Parameters

Set default values on the Define tag:

```jqhtml
<Define:Pagination
    $per_page=25
    $show_total=true
    class="pagination">
  <span>Showing <%= this.args.per_page %> per page</span>
</Define:Pagination>
```

Usage can override defaults:

```jqhtml
<!-- Uses defaults -->
<Pagination />

<!-- Override per_page -->
<Pagination $per_page=50 />
```

## Passing Functions

Pass callbacks for child-to-parent communication:

```jqhtml
<Define:ProductList>
  <% for (let product of this.data.products) { %>
    <ProductCard
      $product=product
      $on_delete=this.handle_delete
    />
  <% } %>
</Define:ProductList>
```

```javascript
class ProductList extends Jqhtml_Component {
  async on_load() {
    this.data.products = await fetch('/api/products').then(r => r.json());
  }

  async handle_delete(product_id) {
    // Delete on server, then reload to refresh the list
    await fetch(`/api/products/${product_id}`, { method: 'DELETE' });
    await this.reload();
  }
}

class ProductCard extends Jqhtml_Component {
  on_ready() {
    this.$sid('delete_btn').on('click', () => {
      this.args.on_delete(this.args.product.id);
    });
  }
}
```

See [State Management](../07-state-management/) for when to use `this.args`, `this.data`, and `this.state`.

## Precedence Summary

| Attribute Type | Define | Invocation | Result |
|---------------|--------|------------|--------|
| Plain (`id`, etc.) | Sets default | Overrides | Invocation wins |
| `data-*` | Sets default | Overrides | Invocation wins |
| `class` | Adds classes | Adds classes | All merged |
| `style` | Adds properties | Adds properties | Merged per-property; invocation wins on conflicts |
| `tag` | Sets element | Overrides | Invocation wins |
| `$` params | Sets defaults | Overrides | Invocation wins |

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/reference/03_dollar_attribute_system.md` - $ attributes and scoped IDs
- `docs/reference/11_attribute_handling_comprehensive.md` - All attribute types

### Last Updated
2026-07-21

### Editorial Notes
- Emphasized quoted vs unquoted distinction - most common mistake
- 2025-12-29: Added function call with string arguments examples
- Class merging behavior is unique and important
- Kept $sid brief since it has its own chapter (09)
- Kept @ events brief since they have their own chapter (10)
- 2026-07-21: Fixed "Sources Merged Together" order - `Component` is appended last (after any inherited parent class names), not before them, per get_class_hierarchy() in component.ts. Fixed style attribute precedence - style merges per-CSS-property like class (invocation wins only on same-property conflicts, non-conflicting Define properties survive), it is not a full string override like plain attributes (id, data-*). Updated the general rule, the Define/Invocation/Result example, and the Precedence Summary table accordingly. Also normalized JqhtmlComponent → Jqhtml_Component to match the actual runtime export.
- Function passing shown as advanced pattern for parent-child communication
- Precedence table provides quick reference
- Omitted jQuery .data() storage details - internal implementation
