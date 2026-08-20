# Clarifications: Attribute Handling and Component Behavior

## Date: October 7, 2025

> **Last Updated**: October 7, 2025
> **Status**: This document has not been reviewed since the November 2025 documentation updates. Content may be outdated. A comprehensive audit and update is pending.

This document captures important clarifications about JQHTML component behavior, attribute handling, and precedence rules that emerged from analyzing test components.

---

## 1. Tag Attribute Behavior

### Question
What is the `tag` attribute doing when used in `<Define>` vs invocation? What's the precedence?

### Clarification

**Tag is NOT an HTML attribute** - it's a special directive that sets the DOM element type.

**Default behavior**: All components render as `<div>` by default.

**At Define**:
```jqhtml
<Define:TableRow tag="tr">
  <!-- This component will ALWAYS render as <tr> -->
</Define:TableRow>
```
Sets the default tag for all instances of this component. Use when a component semantically should always be a specific element (table rows as `<tr>`, list items as `<li>`, etc.).

**At Invocation (Override)**:
```jqhtml
<TableRow tag="span">
  <!-- Overrides the <tr> default, renders as <span> instead -->
</TableRow>
```
Invocation can override the Define tag when needed. This provides flexibility for edge cases while maintaining semantic defaults.

**Precedence**: Invocation `tag` **overrides** Define `tag`

**Use cases**:
- Most components have consistent tags (set in Define)
- Occasionally need flexibility (override at invocation)
- Feature available when useful, not always relevant

---

## 2. Class Name Merging

### Question
How do classes merge when multiple sources provide class names? What's the precedence?

### Clarification

**There is NO precedence** - class names are **merged together, not overridden**.

**Class sources** (all merged):

1. **Existing DOM classes** (when component created on existing element)
   - Used when Blade HTML becomes a component at startup

2. **Define classes**:
   ```jqhtml
   <Define:Card class="card-base">
   ```

3. **Invocation classes**:
   ```jqhtml
   <Card class="card-highlight">
   ```

4. **Component name** (automatic)
   - Component's own class name added automatically

5. **Parent class hierarchy** (automatic)
   - Every parent class up to `Component`

**Example**:
```jqhtml
<Define:UserCard class="base-card">
  <!-- content -->
</Define:UserCard>

<!-- Invoked as: -->
<UserCard class="highlighted">
```

**Rendered**:
```html
<div class="base-card highlighted UserCard Component">
```

**No duplicates**: Same class name won't appear twice

**Purpose**:
- Easy DOM identification: `$('.UserCard')` finds all instances
- CSS targeting: Write rules for component names
- Debugging: Instantly see component type in DevTools
- jQuery selection: `$('.UserCard').each(...)` for batch operations

---

## 3. Attribute Precedence and Handling

### Question
What happens when Define has attributes vs invocation has attributes?

### Clarification

**General Rule**: Invocation attributes **override** Define attributes (except `class` which merges).

**At Define**:
```jqhtml
<Define:Button style="color: bold;" data-theme="light">
  <%= content() %>
</Define:Button>
```

**At Invocation**:
```jqhtml
<Button style="color: red;" data-theme="dark">
  Click Me
</Button>
```

**Result**:
```html
<div style="color: red;" data-theme="dark">
  Click Me
</div>
```

**Special Cases**:

1. **`class`**: Merged (not overridden)
2. **`tag`**: Not an attribute, sets element type
3. **Matching attributes**: Invocation wins
4. **Non-matching attributes**: Both applied

---

## 4. $ Attributes vs data-* vs Plain Attributes

### Question
How do `$`, `data-*`, and plain attributes differ at invocation?

### Clarification

### **Plain Attributes**
Regular HTML attributes, set directly on DOM:

```jqhtml
<Component style="color: red;" id="my-component" disabled>
```

Becomes:
```html
<div style="color: red;" id="my-component" disabled>
```

### **data-* Attributes (without $)**
Data attributes, set directly on DOM:

```jqhtml
<Component data-user-id="123" data-theme="dark">
```

Becomes:
```html
<div data-user-id="123" data-theme="dark">
```

### **$ Attributes**
Component parameters, passed to `this.args`, NOT set as DOM attributes:

```jqhtml
<Component $user_id="123" $theme="dark">
```

**Becomes** (in JavaScript):
```javascript
this.args.user_id = "123"
this.args.theme = "dark"
```

**DOM**: `$` attributes do NOT appear on the rendered element at all — no `data-*` attributes are created:
```html
<div>
```

`$` attributes ARE saved as jQuery `.data()` values (not DOM attributes), making them accessible via both:
- `this.args.user_id` (component class)
- `this.$.data('user_id')` (jQuery, in-memory only — nothing to inspect in the DOM)

### **Critical Difference: Quoted vs Unquoted**

**Quoted = String Literal**:
```jqhtml
<Component $user_id="123">
<!-- this.args.user_id = "123" (string) -->

<Component $data="an_object">
<!-- this.args.data = "an_object" (string literal) -->
```

**Unquoted = JavaScript Expression**:
```jqhtml
<Component $user_id=123>
<!-- this.args.user_id = 123 (number) -->

<Component $data=an_object>
<!-- this.args.data = {actual object reference} -->

<Component $user=this.data.current_user>
<!-- this.args.user = {user object} -->
```

**Practical Usage**:
```jqhtml
<UserProfile_Component $user_id=3 />
```

```javascript
class UserProfile_Component extends Jqhtml_Component {
  async on_load() {
    // Access parameter
    const user_id = this.args.user_id; // 3

    // Fetch data
    const result = await UserController.get_user({user_id});
    this.data = result.user;
  }

  on_ready() {
    // Use loaded data in template
    // Template: User Name: <%= this.data.user_name %>
  }
}
```

**Think of $ attributes as function parameters**:
```javascript
// Like calling:
UserProfile_Component({user_id: 3})
```

---

## 5. @ Attributes (Event Binding)

### Clarification

**@ attributes bind events** to component methods:

```jqhtml
<Define:Button>
  <button @click=this.on_click_handler>
    <%= content() %>
  </button>
</Define:Button>
```

```javascript
class Button extends Jqhtml_Component {
  on_click_handler(event) {
    console.log('Button clicked', event);
  }
}
```

**Syntax**: `@eventname=this.method_name`

Common events:
- `@click`
- `@change`
- `@submit`
- `@focus`
- `@blur`

---

## 6. Component Name Auto-Added to Class

### Question
Is the component name always automatically added to class?

### Clarification

**Yes, always and automatically.**

Every component instance gets:
1. Its own component name as a class
2. All parent classes up to `Component`

**Example**:
```javascript
class CustomButton extends Jqhtml_Component { }
```

**Rendered**:
```html
<div class="CustomButton Component">
```

**With inheritance**:
```javascript
class BaseCard extends Jqhtml_Component { }
class UserCard extends BaseCard { }
```

**Rendered**:
```html
<div class="UserCard BaseCard Component">
```

**Purpose**:
- **Component-name classes** (e.g. `UserCard`, `BaseCard`) have no programmatic reason in JQHTML itself - they exist for:
  - jQuery selection: `$('.UserCard').hide()`
  - Batch operations: `$('.UserCard').each(function() { ... })`
  - CSS targeting: `.UserCard { ... }`
  - Debugging: Instantly identify component types in DevTools
- **The trailing `Component` marker class has a real programmatic purpose** - the framework itself depends on it for internal DOM traversal, not just developer convenience:
  - Finding and stopping all descendant components before clearing the DOM on re-render (`this.$.find('.Component')`)
  - `stop()` uses `.find('.Component')` to cascade-stop all descendant components
  - Off-DOM components' fallback child-discovery (`_get_dom_children()`) uses `.find('.Component')` / `.closest('.Component')` to locate direct child components when the registry-based path isn't available

**Example usage**:
```javascript
// Log all UserCard first names
$('.UserProfile_Component').each(function() {
  const component = $(this).component();
  console.log(component.data.first_name);
});

// Hide all cards
$('.Card').hide();
```

---

## 7. Undefined Components (Incremental Scaffolding)

### Question
What is FakeComponent? Can you use components that don't exist?

### Clarification

**Yes - undefined components work and render as basic containers.**

**Purpose**: Incremental scaffolding - write semantic HTML structure before implementing components.

**Behavior when component undefined**:

**No .jqhtml template**: Gets default template `<%= content() %>`

**No JavaScript class**: Uses base `Jqhtml_Component` with default lifecycle

**Renders as**: `<div>` (or whatever `tag` specifies) with content

**Example**:
```blade
<PageHeader>
  <SiteLogo />
  <NavigationMenu>
    <NavItem>Home</NavItem>
    <NavItem>About</NavItem>
  </NavigationMenu>
</PageHeader>

<PageBody>
  <Sidebar>
    <UserWidget />
  </Sidebar>
  <ContentArea>
    Main content here
  </ContentArea>
</PageBody>
```

**Before implementation**: All render as `<div class="ComponentName Component">` with their content.

**After implementation**: Components gain behavior, custom templates, styling.

**Workflow**:

1. **Scaffold with semantic names**:
   ```blade
   <DashboardWidget>
     <WidgetHeader>Statistics</WidgetHeader>
     <WidgetBody>
       Content here
     </WidgetBody>
   </DashboardWidget>
   ```

2. **Renders as plain divs** (works immediately):
   ```html
   <div class="DashboardWidget Component">
     <div class="WidgetHeader Component">Statistics</div>
     <div class="WidgetBody Component">Content here</div>
   </div>
   ```

3. **Incrementally implement**:
   - Add `.jqhtml` template for custom markup
   - Add `.js` class for behavior
   - Add `.scss` for styling

4. **No refactoring needed** - same component names, just enhanced behavior

**Benefits**:
- Write semantic, readable HTML immediately
- Implement components as needed
- No placeholder/wrapper elements
- Progressive enhancement
- Team can work on structure while components are being built

**This is a deliberate design decision** - flexibility in development workflow, allowing HTML structure to precede implementation.

---

## Summary of Attribute Types

| Attribute Type | Example | Behavior |
|---------------|---------|----------|
| **Plain** | `style="..."` | Set as HTML attribute on DOM |
| **data-*** | `data-sid="123"` | Set as HTML data attribute |
| **$** | `$user_id="123"` | Passed to `this.args`, saved as `.data()` |
| **$ unquoted** | `$user_id=123` | JavaScript expression evaluated |
| **@** | `@click=this.handler` | Event binding to component method |
| **class** | `class="custom"` | Merged with all other classes |
| **tag** | `tag="span"` | Sets DOM element type (not an attribute) |

---

## Key Principles

1. **Invocation overrides Define** (except class which merges)
2. **Class names merge, never override** (no duplicates)
3. **Component name always added** to class automatically
4. **$ attributes = function parameters** to the component
5. **Quoted vs unquoted matters** for $ attributes
6. **@ attributes bind events** to methods
7. **Undefined components work** - incremental scaffolding supported
8. **tag is special** - not an HTML attribute, sets element type
