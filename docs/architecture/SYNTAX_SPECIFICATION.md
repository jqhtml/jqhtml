# JQHTML v2 Complete Syntax & Instruction Format Specification

> **Document Purpose:** This is a comprehensive programming manual for JQHTML developers. Unlike CLAUDE.md (which is the terse, authoritative reference for LLMs), this document provides conversational, educational explanations with extensive examples. Think of this as your friendly guide to understanding JQHTML syntax and concepts deeply.

## Overview

JQHTML v2 is a composable component templating language for jQuery that compiles to efficient JavaScript instruction arrays. This document defines the complete syntax specification and the instruction format that templates compile to.

If you're new to JQHTML, start with [CLAUDE.md](../../CLAUDE.md) for a quick overview, then return here for deep dives into each feature.

## Critical Concepts

### The Instruction Array Pattern

Templates compile to functions that return arrays of rendering instructions:

```javascript
// Every template function returns this structure:
function render(Component, data, args, content) {
  const _output = [];  // Instruction array
  // ... push instructions ...
  return [_output, this];  // CRITICAL: Returns tuple [instructions, context]
}
```

### Why This Pattern Exists

1. **Deferred Execution**: Instructions can be processed when optimal
2. **Single DOM Write**: All HTML built as string, then one `$.html()` call
3. **Complex Attribute Handling**: Functions and objects can't go in HTML strings
4. **Component Coordination**: Parent/child relationships preserved through execution

## Template Syntax

### 1. Component Definition

Components are defined using the `<Define:>` tag:

```jqhtml
<Define:ComponentName>
  <!-- Component template -->
</Define:ComponentName>
```

### 2. Expressions

Output JavaScript expressions using `<%= %>` (escaped) or `<%!= %>` (unescaped):

```jqhtml
<%= this.data.title %>                    <!-- Escaped output -->
<%!= this.data.rawHtml %>                 <!-- Unescaped output -->
<%@= this.data.maybeUndefined %>          <!-- Escaped with error suppression -->
<%!@= this.data.maybeUndefinedHtml %>     <!-- Unescaped with error suppression -->
```

### 3. Code Blocks

Execute JavaScript code using `<% %>`. Regular JavaScript passes through unchanged:

```jqhtml
<% const items = this.data.items || []; %>
<% console.log('Rendering:', items.length); %>

<!-- Regular JavaScript control flow -->
<% if (condition) { %>
  <p>True branch</p>
<% } else { %>
  <p>False branch</p>
<% } %>

<% for (const item of items) { %>
  <div><%= item.name %></div>
<% } %>
```

**Design Rationale**: JavaScript code blocks pass through directly into the generated function. This allows developers to use any JavaScript construct without parser limitations.

### 4. Template Control Flow

Control flow is written in ordinary JavaScript brace style, split across code blocks:

```jqhtml
<% if (condition) { %>
  <p>True branch</p>
<% } else { %>
  <p>False branch</p>
<% } %>

<% for (const item of items) { %>
  <div><%= item.name %></div>
<% } %>
```

This is regular JavaScript rather than special template syntax: the braces open and
close in separate `<% %>` blocks, and the HTML between them is emitted on each pass.


## Component Invocation

### Basic Component Usage

Components are invoked using capital-letter tags:

```jqhtml
<UserCard />                              <!-- Self-closing -->
<UserCard></UserCard>                    <!-- Empty paired tags -->
<UserCard>Default content</UserCard>      <!-- With default slot content -->
```

### Property Passing

```jqhtml
<!-- String literals -->
<UserCard name="John Doe" role="admin" />

<!-- String interpolation -->
<UserCard title="Welcome <%= this.data.userName %>!" />
<div class="card <%= this.data.active ? 'active' : '' %>">

<!-- Data attributes ($property syntax) -->
<UserCard $user=this.data.currentUser $active=true />
<!-- Compiles to: data-user and data-active attributes -->

<!-- Property binding (:property syntax) -->
<UserCard :user="currentUser" :settings="{ theme: 'dark' }" />
<!-- Compiles to: data-bind-user and data-bind-settings attributes -->

<!-- Event binding (@event syntax) -->
<UserCard @save="handleSave" @cancel="() => closeModal()" />
<!-- Compiles to: data-on-save and data-on-cancel attributes -->
```

### $ Attribute System

JQHTML uses the `$` prefix as a shorthand for data attributes with special handling:

#### General Case: `$foo="bar"` → `data-foo`

```jqhtml
<div $user=currentUser $theme="dark" $count=42>
<!-- Compiles to: -->
{tag: ["div", {"data-user": currentUser, "data-theme": "dark", "data-count": 42}, false]}
```

**Runtime Behavior**:
1. The attribute is set via jQuery's `.data()` method: `$element.data('user', currentUser)`
2. For debugging visibility, if the value is a string or number, it's also set as a DOM attribute
3. Objects and arrays are stored in `.data()` but not visible in DOM

#### Special Case: `$sid="name"` → Scoped IDs

The `$sid` attribute has special handling for component-scoped element selection:

```jqhtml
<Define:UserCard>
  <div $sid="container">
    <input $sid="username" type="text" />
    <button $sid="submit">Submit</button>
  </div>
</Define:UserCard>
```

**Compilation**:
```javascript
// In render function (receives _cid parameter)
function render(_cid) {
  const _output = [];
  _output.push({tag: ["div", {"id": "container:" + _cid}, false]});
  _output.push({tag: ["input", {"id": "username:" + _cid, "type": "text"}, false]});
  _output.push({tag: ["button", {"id": "submit:" + _cid}, false]});
  // ...
}
```

**Runtime Usage**:
```javascript
class UserCard extends Component {
  init() {
    // Find scoped elements
    const $username = this.$sid('username');  // Returns $('#username:123')
    const $submit = this.$sid('submit');      // Returns $('#submit:123')
    
    $submit.on('click', () => {
      const value = $username.val();
      // ...
    });
  }
}
```

#### Lexical Scoping of `_cid`

Component IDs flow through lexical scope naturally:

```jqhtml
<Define:ParentComponent>
  <div $sid="parent-element">        <!-- Gets ParentComponent's _cid -->
    <ChildComponent>
      <div $sid="slot-element" />    <!-- Also gets ParentComponent's _cid -->
    </ChildComponent>
  </div>
</Define:ParentComponent>

<Define:ChildComponent>
  <div $sid="child-element">         <!-- Gets ChildComponent's _cid -->
    <%= content() %>                <!-- Slot content preserves parent's _cid -->
  </div>
</Define:ChildComponent>
```

This happens because content functions capture their defining scope:
```javascript
// ParentComponent render
function render(_cid) {  // Parent's _cid = 123
  _output.push({comp: ["ChildComponent", {}, () => {
    // This arrow function captures Parent's _cid
    const _output = [];
    _output.push({tag: ["div", {"id": "slot-element:" + _cid}, false]});  // slot-element:123
    return [_output, this];
  }]});
}

// ChildComponent render  
function render(_cid) {  // Child's _cid = 456
  _output.push({tag: ["div", {"id": "child-element:" + _cid}, false]});  // child-element:456
}
```

#### Attribute Value Interpolation

Within quoted attribute values, `<%= %>` and `<%!= %>` perform string interpolation:

```jqhtml
<!-- Both of these work identically in attributes -->
<div title="User: <%= user.name %>">
<div title="User: <%!= user.name %>">

<!-- Compiles to -->
{tag: ["div", {"title": "User: " + user.name}, false]}
```

**Design Rationale**: Inside attribute values, HTML escaping is inappropriate because we're building a JavaScript string, not HTML content. The JavaScript string serialization handles all necessary escaping (quotes, backslashes, etc.). This is semantically different from top-level `<%= %>` which outputs to HTML and requires escaping.

## Binding Syntax (v2)

### Property Binding with `:`

The `:` prefix creates dynamic property bindings that are always evaluated as JavaScript expressions:

```jqhtml
<!-- Simple property binding -->
<input :value="formData.name" :disabled="isLoading" />

<!-- Complex expressions -->
<div :style="{ color: textColor, fontSize: size + 'px' }" />

<!-- Method calls -->
<select :options="getOptions(category)" />
```

**Compilation**:
- `:prop="expr"` → `{"data-bind-prop": expr}` (no quotes around expr)
- Values are ALWAYS treated as JavaScript expressions
- Even quoted strings like `:prop="value"` become expressions

### Event Binding with `@`

The `@` prefix binds event handlers:

```jqhtml
<!-- Simple handler -->
<button @click="handleClick">Click Me</button>

<!-- With arguments -->
<button @click="deleteItem(item.id)">Delete</button>

<!-- Inline arrow function -->
<input @input="(e) => updateValue(e.target.value)" />

<!-- Multiple events -->
<form @submit="save" @reset="clear">
```

**Compilation**:
- `@event="handler"` → `{"data-on-event": handler}`
- Handlers are JavaScript expressions (function references or inline functions)

### Binding Design Rationale

1. **Vue.js Familiarity**: Uses the same `:prop` and `@event` syntax as Vue.js
2. **Always Expressions**: Unlike `$` attributes which distinguish strings vs expressions, bindings are ALWAYS expressions
3. **Runtime Processing**: The runtime will need to handle these specially:
   - `data-bind-*` attributes set properties dynamically
   - `data-on-*` attributes attach event listeners
4. **Separate from `$` System**: Bindings serve a different purpose than data attributes

## Slot System

### 1. Named Slots

Pass content to specific slots using `<Slot:slotname>` syntax:

```jqhtml
<DataTable $items=this.data.users>
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
  
  <Slot:empty />  <!-- Self-closing slot -->
</DataTable>
```

### 2. Accessing Slots in Components

Components access slot content using the `content()` function:

```jqhtml
<Define:Card>
  <div class="card">
    <!-- Render default slot -->
    <%= content() %>
    
    <!-- Render named slot -->
    <% if (content('footer')) { %>
      <footer>
        <%= content('footer', { timestamp: new Date() }) %>
      </footer>
    <% } %>
  </div>
</Define:Card>
```

## Instruction Format Reference

### Instruction Types

Templates compile to three instruction types:

1. **`{tag: [...]}`** - HTML elements
2. **`{comp: [...]}`** - Component invocations
3. **`{slot: [...]}`** - Slot definitions

### 1. Tag Instruction

```javascript
{tag: [tagname, attributes, self_closing]}
```

**Format:**
- `tagname`: String - HTML tag name
- `attributes`: Object - Tag attributes (may contain functions!)
- `self_closing`: Boolean - Whether tag self-closes

**Examples:**
```javascript
{tag: ["div", {"class": "user-card"}, false]}
{tag: ["img", {"src": "/avatar.jpg", "alt": "User"}, true]}
{tag: ["button", {"onclick": this.handleClick}, false]}
{tag: ["div", {"data-sid": "header"}, false]}  // $sid becomes data-id
```

### 2. Component Instruction

```javascript
{comp: [component_name, attributes, optional_innerhtml_function]}
```

**Format:**
- `component_name`: String - Component to instantiate
- `attributes`: Object - Props/attributes to pass
- `optional_innerhtml_function`: Function - Contains slots and default content

**CRITICAL**: When a component invocation contains slots or any child content, it MUST use the three-parameter form with a content function. Slots are NOT separate instructions after the component - they are contained within the component's content function.

**Examples:**
```javascript
// Simple component (no children)
{comp: ["UserAvatar", {"data-userId": this.data.id}]}

// Component with slots
{comp: ["DataTable", {"data-rows": this.data.items}, (DataTable) => {
  const _output = [];
  _output.push({slot: ["header", {}, (header) => {
    const _output = [];
    _output.push({tag: ["th", {}, false]});
    _output.push("Name");
    _output.push("</th>");
    return [_output, this];
  }]});
  return [_output, this];
}]}
```

### 3. Slot Instruction

```javascript
{slot: [slot_name, attributes, render_function]}
```

**Format:**
- `slot_name`: String - Slot identifier
- `attributes`: Object - Props for slot
- `render_function`: Function - Returns `[instructions, context]`

**Example:**
```javascript
{slot: ["actions", {}, (actions) => {
  const _output = [];
  _output.push({tag: ["button", {"onclick": this.delete}, false]});
  _output.push("Delete");
  _output.push("</button>");
  return [_output, this];
}]}
```

### 4. String Output

Raw strings are pushed directly:

```javascript
_output.push({tag: ["div", {}, false]});  // Opening tag (instruction)
_output.push("Hello, ");                  // Raw text
_output.push(html(this.data.name));       // Escaped text
_output.push("</div>");                   // Closing tag (raw string!)
```

**CRITICAL**: Closing tags are ALWAYS raw strings, not instructions.

## Context Preservation

### v1 Pattern: `_that = this`

The v1 pattern preserves component context through nested functions:

```javascript
function render(Component, data, args, content) {
  let _that = this;  // Preserve component instance
  let _output = [];
  
  _output.push({comp: ["Child", {}, function(Child) {
    let _output = [];
    // _that still refers to parent component
    _output.push(html(_that.data.value));
    return [_output, _that];
  }.bind(_that)]});
  
  return [_output, _that];
}
```

### v2 Pattern: Arrow Functions

v2 uses arrow functions for natural context preservation:

```javascript
function render(Component, data, args, content) {
  const _output = [];
  
  _output.push({comp: ["Child", {}, (Child) => {
    const _output = [];
    // 'this' refers to parent component naturally
    _output.push(html(this.data.value));
    return [_output, this];
  }]});
  
  return [_output, this];
}
```

## Runtime Processing

### Phase 1: Instruction Execution

```javascript
let [instructions, context] = template.render.bind(component)(
  component,
  component.data,
  args,
  content_fn
);
```

### Phase 2: Instruction Processing

1. **Build HTML**: Process all string and simple tag instructions
2. **Track Complex Elements**: Store elements with function attributes
3. **Single DOM Write**: `component.$.html(html.join(''))`
4. **Apply Attributes**: Attach event handlers and complex attributes
5. **Initialize Components**: Create child component instances

## Self-Closing HTML Tags

The following HTML tags are automatically treated as self-closing:
- `area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`
- `link`, `meta`, `param`, `source`, `track`, `wbr`

## Complete Example

### Template

```jqhtml
<Define:UserDashboard>
  <div class="dashboard">
    <Header $title="User Management">
      <Slot:actions>
        <button @click=this.addUser>Add User</button>
      </Slot:actions>
    </Header>
    
    <% if (this.data.loading) { %>
      <LoadingSpinner />
    <% } else { %>
      <UserTable $users=this.data.users>
        <Slot:header>
          <th>ID</th>
          <th>Name</th>
          <th>Actions</th>
        </Slot:header>
        
        <Slot:row>
          <td><%= row.id %></td>
          <td><%= row.name %></td>
          <td>
            <button @click=this.editUser>Edit</button>
          </td>
        </Slot:row>
      </UserTable>
    <% } %>
  </div>
</Define:UserDashboard>
```

### Compiled Output Structure

```javascript
function render(Component, data, args, content) {
  const _output = [];
  
  _output.push({tag: ["div", {"class": "dashboard"}, false]});
  
  // Header component with slots
  _output.push({comp: ["Header", {"data-title": "User Management"}, (Header) => {
    const _output = [];
    _output.push({slot: ["actions", {}, (actions) => {
      const _output = [];
      _output.push({tag: ["button", {"data-onclick": this.addUser}, false]});
      _output.push("Add User");
      _output.push("</button>");
      return [_output, this];
    }]});
    return [_output, this];
  }]});
  
  // ... rest of compilation
  
  _output.push("</div>");
  return [_output, this];
}
```

## Component CSS Classes

When components are rendered, the runtime automatically applies CSS classes based on the component's inheritance hierarchy:

```html
<!-- For a UserCard extending BaseCard extending Component -->
<div class="UserCard BaseCard Component" ...>
```

This enables CSS targeting at any level of the hierarchy:
```css
.Component { /* all components */ }
.UserCard { /* specific component type */ }
.BaseCard { /* all cards */ }
```

**Implementation Note**: The Component base class automatically applies these classes during initialization. This feature works regardless of minification since class names are preserved through the component's constructor name.

## Critical Implementation Rules

### What MUST Be Preserved

1. **Instruction Array Structure**: The `{tag:...}`, `{comp:...}`, `{slot:...}` format
2. **Return Tuple**: Functions MUST return `[instructions, context]`
3. **Deferred Component Init**: Components render as placeholders first
4. **Single DOM Write**: Build all HTML, write once
5. **Content Function**: Parent components receive content function to access slots

### Common Pitfalls

1. **Forgetting Return Format**: Must return `[array, context]`, not just array
2. **String vs Instruction**: Closing tags are strings, opening tags are instructions
3. **Context Loss**: Without proper binding, nested functions lose component reference
4. **Direct DOM Manipulation**: Never manipulate DOM during instruction building
5. **Missing html() Escaping**: User content must be escaped
6. **Slots Outside Components**: Slots must be inside component content functions