# Template Inheritance

JQHTML supports three mechanisms for component inheritance that can work together: JavaScript class inheritance, the `extends` attribute, and slot-based inheritance.

## JavaScript Class Inheritance

Standard ES6 class inheritance for behavior:

```javascript
class BaseCard extends Jqhtml_Component {
  on_ready() {
    this.$sid('close').on('click', () => this.close());
  }

  close() {
    this.$.fadeOut();
  }
}

class UserCard extends BaseCard {
  async on_load() {
    this.data.user = await fetch(`/api/users/${this.args.user_id}`).then(r => r.json());
  }
}
```

The child class inherits methods and can override lifecycle hooks.

## Template extends Attribute

Use `extends=""` to inherit another component's template:

```jqhtml
<Define:DataGrid_Abstract class="table-container">
  <table class="table">
    <thead><tr><%= content('header') %></tr></thead>
    <tbody>
      <% for (let record of this.data.records) { %>
        <tr><%= content('row', record) %></tr>
      <% } %>
    </tbody>
  </table>
</Define:DataGrid_Abstract>
```

```jqhtml
<Define:UsersDataGrid extends="DataGrid_Abstract">
  <Slot:header>
    <th>ID</th>
    <th>Name</th>
    <th>Email</th>
  </Slot:header>

  <Slot:row>
    <td><%= row.id %></td>
    <td><%= row.name %></td>
    <td><%= row.email %></td>
  </Slot:row>
</Define:UsersDataGrid>
```

The child provides slot content that renders within the parent's structure.

## Slot-Based Inheritance (Automatic)

When a component template contains **only slots** (no HTML), it automatically inherits from the JavaScript parent class template:

```javascript
// JavaScript class hierarchy
class UsersDataGrid extends DataGrid_Abstract {
  async on_load() {
    this.data.records = await fetch('/api/users').then(r => r.json());
  }
}
```

```jqhtml
<!-- Slot-only template triggers automatic inheritance -->
<Define:UsersDataGrid>
  <Slot:header>
    <th>ID</th>
    <th>Name</th>
  </Slot:header>

  <Slot:row>
    <td><%= row.id %></td>
    <td><%= row.name %></td>
  </Slot:row>
</Define:UsersDataGrid>
```

The framework walks the JavaScript prototype chain to find the parent template.

## Combined Example

All three mechanisms working together:

**1. Base class and template:**

```jqhtml
<Define:CardAbstract class="card">
  <div class="card-header"><%= content('header') %></div>
  <div class="card-body"><%= content('body') %></div>
</Define:CardAbstract>
```

```javascript
class CardAbstract extends Jqhtml_Component {
  on_ready() {
    this.$sid('close').on('click', () => this.close());
  }

  close() {
    this.$.remove();
  }
}
```

**2. Child extends both:**

```jqhtml
<Define:UserCard extends="CardAbstract">
  <Slot:header>
    <h5><%= this.data.name %></h5>
    <button $sid="close">×</button>
  </Slot:header>

  <Slot:body>
    <p><%= this.data.email %></p>
  </Slot:body>
</Define:UserCard>
```

```javascript
class UserCard extends CardAbstract {
  async on_load() {
    this.data = await fetch(`/api/users/${this.args.user_id}`).then(r => r.json());
  }
}
```

**Result:**
- Template structure from `CardAbstract` template
- Slot content from `UserCard` template
- Close behavior inherited from `CardAbstract` class
- Data loading from `UserCard` class

## When to Use Each Approach

| Approach | Use When |
|----------|----------|
| JS Class Inheritance | Sharing behavior and lifecycle logic |
| `extends` Attribute | Explicitly using another component's template structure |
| Slot-Based | Auto-inheriting from JS parent's template |

## Class Name Inheritance

Component classes propagate through inheritance. A `UserCard` extending `BaseCard` renders:

```html
<div class="UserCard BaseCard Component card">
```

All parent class names are included automatically.

## Attribute Precedence

When inheriting templates, child attributes can override parent defaults:

| Attribute | Behavior |
|-----------|----------|
| `class` | **Merged** - both parent and child classes applied |
| `tag` | **Not inherited** - each `<Define:>` must set its own `tag=""` or it defaults to `div`, regardless of the parent's `tag` |
| Other attributes | Child overrides parent |

```jqhtml
<!-- Parent -->
<Define:BaseButton tag="button" class="btn" disabled>

<!-- Child - must repeat tag="button", it is NOT inherited from BaseButton -->
<Define:PrimaryButton tag="button" extends="BaseButton" class="btn-primary">
<!-- Result: class="PrimaryButton BaseButton Component btn btn-primary" -->
```

**Gotcha:** If `PrimaryButton` omitted `tag="button"`, it would render as a `<div>`, not a `<button>` - `tag` determines the DOM element type at compile time and is never resolved through the `extends` chain.

**Note:** Exact class order (hierarchy classes vs. styling classes) is an implementation detail, not a guaranteed contract - only presence of all classes is guaranteed.

## Parent-Child Communication

Pass callbacks as parameters for child-to-parent communication:

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
    this.$sid('delete').on('click', () => {
      this.args.on_delete(this.args.product.id);
    });
  }
}
```

## Slot Forwarding (Advanced)

Middle-layer components can forward slots from parent to child:

**Top level defines content:**
```jqhtml
<DataGrid>
  <Slot:row>
    <td><%= row.name %></td>
  </Slot:row>
</DataGrid>
```

**Middle layer forwards:**
```jqhtml
<Define:DataGrid>
  <TableBody>
    <Slot:row>
      <%= content('row', row) %>
    </Slot:row>
  </TableBody>
</Define:DataGrid>
```

**Leaf renders:**
```jqhtml
<Define:TableBody>
  <% for (let row of this.data.rows) { %>
    <tr><%= content('row', row) %></tr>
  <% } %>
</Define:TableBody>
```

Use for multi-layer architectures where presentation is defined at the top but rendering happens at the bottom.

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/official/06_slot_system.md` - Slot-based template inheritance
- `docs/official/10_clarifications_attribute_precedence.md` - Attribute precedence rules

### Last Updated
2025-11-25

### Editorial Notes
- Three mechanisms (JS class, extends, slot-based) presented clearly
- Combined example shows all three working together
- Slot forwarding included but marked as advanced
- Attribute precedence table kept brief
- Parent-child communication pattern important for real apps
- Class name inheritance explained (automatic propagation)
- **2026-07-21 accuracy pass:** Corrected `tag` row in Attribute Precedence table - `tag` is NOT inherited through `extends` (component.ts deletes it from the merged-attributes chain; each `<Define:>` must set its own `tag=""` or it defaults to `div`). Fixed the PrimaryButton example to declare `tag="button"` explicitly and reconciled its class order with the "Class Name Inheritance" example (hierarchy classes first, styling classes last matches `component.ts`'s actual application order), with a note that exact order isn't a guaranteed contract. Fixed `JqhtmlComponent` references to `Jqhtml_Component`.
