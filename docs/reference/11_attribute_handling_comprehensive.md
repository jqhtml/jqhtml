# Comprehensive Attribute Handling and Precedence

## Overview

JQHTML provides multiple ways to set attributes on components, each with specific behaviors and purposes. Understanding these differences is critical for effective component development.

## Attribute Types

### 1. Plain HTML Attributes

Regular HTML attributes set directly on the DOM element.

**Syntax**:
```jqhtml
<Component id="my-id" disabled>
```

**Rendered**:
```html
<div id="my-id" disabled>
```

**Use for**: Standard HTML attributes (id, disabled, aria-*, etc.)

**Note**: `style` is NOT a plain wholesale-override attribute — it has its own CSS-property-level merge behavior. See "style Attribute" below.

---

### 2. data-* Attributes (Without $ Prefix)

HTML5 data attributes set directly on DOM.

**Syntax**:
```jqhtml
<Component data-user-id="123" data-theme="dark">
```

**Rendered**:
```html
<div data-user-id="123" data-theme="dark">
```

**Access**:
```javascript
// Via jQuery
this.$.data('user-id'); // "123"
this.$.data('theme');   // "dark"
```

**Use for**: Simple data storage on DOM element

---

### 3. $ Attributes (Component Parameters)

Component arguments passed to `this.args`, NOT set as literal HTML attributes.

**Syntax**:
```jqhtml
<UserCard $user_id="123" $theme="dark">
```

**Behavior**:
- Available as `this.args.user_id`, `this.args.theme`
- Also saved as jQuery `.data()` values (in-memory only)
- Does NOT appear in the DOM at all — no `data-*` attributes are created

**JavaScript Access**:
```javascript
class UserCard extends Jqhtml_Component {
  on_create() {
    console.log(this.args.user_id);  // "123"
    console.log(this.args.theme);    // "dark"
  }

  on_ready() {
    // Also available via jQuery .data() (not a DOM attribute lookup)
    console.log(this.$.data('user_id')); // "123"
  }
}
```

**DOM Rendered**:
```html
<div class="UserCard Component">
```

#### Quoted vs Unquoted Values

**Critical distinction**:

**Quoted = String Literal**:
```jqhtml
<Component $user_id="123">
<!-- this.args.user_id = "123" (string) -->

<Component $data="my_variable">
<!-- this.args.data = "my_variable" (literal string) -->
```

**Unquoted = JavaScript Expression**:
```jqhtml
<Component $user_id=123>
<!-- this.args.user_id = 123 (number) -->

<Component $data=my_variable>
<!-- this.args.data = {value of my_variable} -->

<Component $user=this.data.current_user>
<!-- this.args.user = {user object reference} -->

<Component $enabled=true>
<!-- this.args.enabled = true (boolean) -->

<Component $handler=this.on_click>
<!-- this.args.handler = function reference -->

<Component $max_length=My_Model.field_length('last_name')>
<!-- this.args.max_length = return value of My_Model.field_length('last_name') -->

<Component $default=this.get_value('name')>
<!-- this.args.default = return value of this.get_value('name') -->
```

**Restrictions on unquoted values**:
- **No spaces allowed** - Parser terminates at first space. `$id=get_id(user,true)` works, `$id=get_id(user, true)` does not.
- **Negative numbers supported** - `$offset=-1` or `$value=-45.67`
- **String arguments supported** - Single or double quotes work inside function calls: `$val=func('arg')` or `$val=func("arg")`
- **Synchronous only** - Expressions evaluate during template rendering. No `await` or async operations.

**Example Usage**:
```jqhtml
<UserList>
  <% for (let user of this.data.users) { %>
    <UserCard
      $user_id=user.id
      $user=user
      $theme="light"
      $can_edit=user.is_admin
    />
  <% } %>
</UserList>
```

```javascript
class UserCard extends Jqhtml_Component {
  async on_load() {
    // If passed user object directly, use it
    if (this.args.user) {
      this.data = this.args.user;
    } else {
      // Otherwise fetch by ID
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

**Think of $ attributes as function parameters**:
```javascript
// Component invocation is like:
UserCard({
  user_id: 123,
  theme: "light",
  can_edit: true
})
```

---

### 4. @ Attributes (Event Binding)

Bind DOM events to component methods.

**Syntax**:
```jqhtml
<Define:Button>
  <button @click=this.handle_click @mouseover=this.handle_hover>
    <%= content() %>
  </button>
</Define:Button>
```

```javascript
class Button extends Jqhtml_Component {
  handle_click(event) {
    console.log('Clicked', event);
    this.$.addClass('clicked');
  }

  handle_hover(event) {
    console.log('Hovered', event);
  }
}
```

**Common Events**:
- `@click`
- `@change`
- `@submit`
- `@focus`
- `@blur`
- `@keyup`
- `@keydown`

**Use for**: Declarative event binding in templates

---

### 5. class Attribute (Special Merging)

The `class` attribute has **special merging behavior** - it never overrides, only adds.

**Sources (all merged)**:

1. Existing DOM classes (if component created on existing element)
2. Define classes
3. Invocation classes
4. Component name (automatic)
5. Parent class hierarchy (automatic)

**Example**:
```jqhtml
<Define:CustomCard class="card-base elevated">
  <%= content() %>
</Define:CustomCard>

<!-- HTML before component init: -->
<CustomCard class="featured" id="main-card">

<!-- Component invocation: -->
<CustomCard class="highlighted bordered">
```

**All three rendered together**:
```html
<div class="card-base elevated featured highlighted bordered CustomCard Component">
```

**No duplicates**: If same class appears multiple times, only included once.

**Inheritance example**:
```javascript
class BaseWidget extends Jqhtml_Component { }
class StatsWidget extends BaseWidget { }
```

**Rendered**:
```html
<div class="StatsWidget BaseWidget Component">
```

---

### 6. style Attribute (CSS Property-Level Merging)

Like `class`, the `style` attribute has **special merging behavior** - but it merges at the individual CSS-property level rather than the whole-string level. It is NOT a wholesale-override attribute.

**How it merges**: Both Define's and invocation's `style` strings are parsed into individual `property: value` declarations. Invocation wins only on properties that appear in BOTH; any Define property that does NOT conflict with an invocation property is preserved in the merged output.

**Example (conflicting property)**:
```jqhtml
<Define:Alert style="color: red; font-size: 14px;">
  <%= content() %>
</Define:Alert>

<!-- Usage: -->
<Alert style="color: blue; margin: 10px;">
```

**Rendered** (merged, invocation wins only on `color`):
```html
<div style="color: blue; margin: 10px; font-size: 14px">
```

**Example (fully non-overlapping properties)**:
```jqhtml
<Define:Card style="padding: 5px; border: 1px solid black;">
  <%= content() %>
</Define:Card>

<!-- Usage: -->
<Card style="color: green; margin: 20px;">
```

**Rendered** (all four properties preserved):
```html
<div style="color: green; margin: 20px; padding: 5px; border: 1px solid black">
```

**Use for**: Setting default inline styles at Define that invocation can selectively override property-by-property, without needing to repeat the whole style string.

---

### 7. tag Attribute (Element Type, Not Attribute)

The `tag` attribute is **special** - it's not rendered as an HTML attribute but determines the DOM element type.

**Default**: All components render as `<div>` by default.

**At Define**:
```jqhtml
<Define:TableRow tag="tr">
  <td><%= this.data.name %></td>
  <td><%= this.data.value %></td>
</Define:TableRow>
```

**At Invocation (Override)**:
```jqhtml
<TableRow tag="span">
  <!-- Overrides tr, renders as span -->
</TableRow>
```

**Precedence**: Invocation `tag` **overrides** Define `tag`.

**Use cases**:
- Semantic HTML: `<tr>`, `<li>`, `<td>`, `<span>`, `<article>`
- Components that should always be specific elements
- Occasional override for edge cases

---

### 8. Conditional Attributes (PHTML-style)

Include attributes conditionally based on runtime conditions using conditional blocks in the attribute list.

**Syntax**:
```jqhtml
<Define:Button>
  <button
    class="btn"
    <% if (this.args.primary) { %>data-variant="primary"<% } %>
    <% if (this.args.disabled) { %>disabled<% } %>
  >
    <%= this.args.label %>
  </button>
</Define:Button>
```

**How it works**:
- Conditional blocks (`<% if (...) { %>`) can appear in attribute lists
- Attributes inside conditionals are evaluated at runtime
- Boolean attributes (disabled, checked, readonly) are included/excluded based on condition
- For conditional classes, use in-string conditionals: `class="base <% if (x) { %>extra<% } %>"`

**Common use cases**:
```jqhtml
<%-- Conditional styling (in-string) --%>
<div class="base <% if (this.data.active) { %>active<% } %> <% if (this.data.error) { %>error<% } %>">

<%-- Conditional data attributes --%>
<input
  type="text"
  <% if (this.args.max) { %>
    data-max="<%= this.args.max %>"
  <% } %>
>

<%-- Conditional boolean attributes --%>
<input
  type="checkbox"
  <% if (this.data.checked) { %>checked<% } %>
  <% if (this.args.readonly) { %>readonly<% } %>
>
```

**Rendered example**:
```jqhtml
<Button $primary=true $label="Save">
```

Renders as:
```html
<button class="btn btn-primary">Save</button>
```

**Note**: This is a production-ready feature providing PHTML-style flexibility. Most conditional logic should be in component data/args, but this is useful when you need attribute-level conditionals similar to PHP templates.

---

## Attribute Precedence Rules

### General Rule

**Invocation attributes override Define attributes** (except `class`, which merges class lists, and `style`, which merges CSS properties - see "class Attribute" and "style Attribute" above).

### At Define
```jqhtml
<Define:Panel style="padding: 10px;" data-theme="light" class="panel-base">
  <%= content() %>
</Define:Panel>
```

### At Invocation
```jqhtml
<Panel style="padding: 20px;" data-theme="dark" class="panel-highlighted">
```

### Result
```html
<div
  style="padding: 20px;"
  data-theme="dark"
  class="panel-base panel-highlighted Panel Component">
```

**Breakdown**:
- `style`: **Merged property-by-property** - both Define's and invocation's `style` are parsed into individual CSS declarations; here both set `padding`, so invocation's `padding: 20px;` wins that one property (see "style Attribute" above for an example with non-conflicting properties, where Define's properties are preserved alongside invocation's)
- `data-theme`: Invocation value `dark` wins (plain wholesale override - `data-*` attributes are not merged)
- `class`: **Merged** - both `panel-base` and `panel-highlighted`
- Component name added: `Panel`
- Base class added: `Component`

---

## Attribute Location Examples

### On Define
```jqhtml
<Define:Button tag="button" class="btn" disabled="disabled">
  <%= content() %>
</Define:Button>
```

**Every instance gets**: `tag="button"`, `class="btn"`, `disabled` attribute

### On Invocation
```jqhtml
<Button class="btn-primary" id="submit-btn">
  Submit
</Button>
```

**This instance gets**:
- Merged classes: `btn btn-primary Button Component`
- Added attribute: `id="submit-btn"`
- Inherited: `disabled` from Define

### Combined Result
```html
<button id="submit-btn" disabled class="btn btn-primary Button Component">
  Submit
</button>
```

---

## Complete Attribute Decision Table

| Attribute | Define | Invocation | Result |
|-----------|--------|------------|--------|
| **Plain** | `id="A"` | `id="B"` | `id="B"` (invocation wins) |
| **style** | `style="color: red"` | `style="color: blue; margin: 10px"` | `style="color: blue; margin: 10px"` (merged property-by-property, invocation wins only on matching properties) |
| **data-*** | `data-x="A"` | `data-x="B"` | `data-x="B"` (invocation wins) |
| **$** | N/A | `$user_id="123"` | `this.args.user_id = "123"` (jQuery `.data()` only - no `data-*` attribute is created) |
| **$sid** | N/A | `$sid="123"` | `id="123:<cid>"` + `data-sid="123"` (scoped-ID mechanism - does NOT populate `this.args`) |
| **@** | `@click=A` | N/A | Binds event to method A |
| **class** | `class="A"` | `class="B"` | `class="A B ComponentName Component"` (merged) |
| **tag** | `tag="span"` | `tag="div"` | `<div>` (invocation wins) |

---

## Practical Patterns

### 1. Component with Default Styling
```jqhtml
<Define:Alert tag="aside" class="alert" role="alert">
  <div class="alert-icon">⚠️</div>
  <div class="alert-message">
    <%= content() %>
  </div>
</Define:Alert>

<!-- Usage: -->
<Alert class="alert-danger">
  Error occurred!
</Alert>

<!-- Renders: -->
<aside role="alert" class="alert alert-danger Alert Component">
  <div class="alert-icon">⚠️</div>
  <div class="alert-message">Error occurred!</div>
</aside>
```

### 2. Data-Driven Component
```jqhtml
<Define:ProductCard>
  <div class="product">
    <h3><%= this.data.name %></h3>
    <p>$<%= this.data.price %></p>
  </div>
</Define:ProductCard>

<!-- Usage: -->
<% for (let product of this.data.products) { %>
  <ProductCard
    $product_id=product.id
    $featured=product.featured
    class="<%= product.featured ? 'featured' : '' %>"
  />
<% } %>
```

### 3. Event-Driven Component
```jqhtml
<Define:ToggleSwitch>
  <label class="switch">
    <input type="checkbox" $sid="checkbox" @change=this.handle_toggle />
    <span class="slider"></span>
  </label>
</Define:ToggleSwitch>
```

```javascript
class ToggleSwitch extends Jqhtml_Component {
  handle_toggle(event) {
    const checked = this.$sid('checkbox').prop('checked');
    this.$.trigger('toggle-changed', [checked]);
  }
}
```

---

## Key Concepts

1. **$ attributes = component parameters** - Passed to `this.args`
2. **Quoted vs unquoted critical** - String literal vs JS expression
3. **@ attributes bind events** - Declarative event handling
4. **class always merges** - Never overrides
5. **tag sets element type** - Not an HTML attribute
6. **Invocation overrides Define** - Except class (merges) and tag (overrides)
7. **Component name auto-added** - Always in class attribute
8. **Parent classes included** - Full inheritance chain in classes
