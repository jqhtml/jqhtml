# Slot System (Named Content Areas)

## Overview

The slot system allows components to receive multiple named content areas. This is an **advanced feature** - most components use simple `content()` and don't need slots.

**Rule**: Use slots only when you need multiple distinct content placement areas.

## When to Use Slots

### ✅ Use Slots For

- Complex layouts with specific content placement
- Data table templates with separate row/header/footer sections
- Card components with distinct header/body/footer areas
- Dialog components with title/content/actions sections

### ❌ Don't Use Slots For

- Simple wrapper components (use `content()` instead)
- Single content area components
- Most basic components (95% of use cases)

## Basic Slot Syntax

### Defining Slots in Component Template

Use `<Slot:slotname>` to define where slot content will be rendered:

```jqhtml
<Define:Card>
  <div class="card">
    <div class="card-header">
      <%= content('header') %>
    </div>
    <div class="card-body">
      <%= content('body') %>
    </div>
    <div class="card-footer">
      <%= content('footer') %>
    </div>
  </div>
</Define:Card>
```

### Providing Slot Content

Use `<Slot:slotname>` tags to provide content for specific slots:

```jqhtml
<Card>
  <Slot:header>
    <h3>User Settings</h3>
  </Slot:header>

  <Slot:body>
    <p>Main card content goes here</p>
    <button>Save</button>
  </Slot:body>

  <Slot:footer>
    <small>Last updated: Today</small>
  </Slot:footer>
</Card>
```

**Important:** When using named slots, ALL content must be in `<Slot:>` tags. You cannot have loose content outside of slots.

## Simple content() (No Slots)

For components with a single content area, use `content()` without slots:

```jqhtml
<Define:Panel>
  <div class="panel">
    <%= content() %>
  </div>
</Define:Panel>

<Panel>
  <p>This content goes directly into the panel</p>
  <button>OK</button>
</Panel>
```

This is the most common pattern (95% of components). Only use named slots when you need multiple distinct content areas.

```jqhtml
<Define:Card>
  <div class="body">
    <%= content() %>  <!-- All inner content goes here -->
  </div>
</Define:Card>
```

## Named Slots

### Multiple Named Slots

```jqhtml
<Define:Dialog>
  <div class="dialog">
    <div class="dialog-title">
      <%= content('title') %>
    </div>
    <div class="dialog-content">
      <%= content('content') %>
    </div>
    <div class="dialog-actions">
      <%= content('actions') %>
    </div>
  </div>
</Define:Dialog>
```

**Usage:**

```jqhtml
<Dialog>
  <Slot:title>
    <h2>Confirm Action</h2>
  </Slot:title>

  <Slot:content>
    <p>Are you sure you want to proceed?</p>
  </Slot:content>

  <Slot:actions>
    <button @click=this.confirm>Yes</button>
    <button @click=this.cancel>No</button>
  </Slot:actions>
</Dialog>
```

## Data Table Example (Common Use Case)

### Component Definition

```jqhtml
<Define:DataTable>
  <table>
    <thead>
      <tr>
        <%= content('header') %>
      </tr>
    </thead>
    <tbody>
      <% for (let row of this.args.items) { %>
        <tr>
          <%= content('row') %>
        </tr>
      <% } %>
    </tbody>
    <tfoot>
      <%= content('footer') %>
    </tfoot>
  </table>
</Define:DataTable>
```

### Usage

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

  <Slot:footer>
    <td colspan="3">Total: <%= this.data.users.length %></td>
  </Slot:footer>
</DataTable>
```

**Note**: Within slot content, `row` variable is available from the parent's loop context.

## Passing Data to Slots

Parent templates can pass data when invoking slots using `content('slotname', data)`:

```jqhtml
<Define:DataGrid_Abstract>
  <table>
    <thead><tr><%= content('header') %></tr></thead>
    <tbody>
      <% for (let record of this.data.records) { %>
        <tr><%= content('row', record) %></tr>
      <% } %>
    </tbody>
  </table>
</Define:DataGrid_Abstract>
```

Slot definitions receive data as a parameter matching the slot name:

```jqhtml
<Slot:row>
  <td><strong><%= row.id %></strong></td>
  <td><%= row.name %></td>
  <td><%= row.email %></td>
</Slot:row>
```

The parameter name matches the slot name, allowing child templates to access parent data directly.

## Slot-Based Template Inheritance

When a component template contains **ONLY slots at the top level** (no HTML), it automatically inherits the parent class template:

**Parent template (provides structure):**
```jqhtml
<Define:DataGrid_Abstract>
  <div class="card">
    <table class="table">
      <thead><tr><%= content('header') %></tr></thead>
      <tbody>
        <% for (let record of this.data.records) { %>
          <tr><%= content('row', record) %></tr>
        <% } %>
      </tbody>
    </table>
  </div>
</Define:DataGrid_Abstract>
```

**Parent class (JavaScript):**
```javascript
class UsersDataGrid extends DataGrid_Abstract {
  async on_load() {
    this.data.records = await fetch('/api/users').then(r => r.json());
  }
}
```

**Child template (slot-only triggers inheritance):**
```jqhtml
<Define:UsersDataGrid>
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

**Result**: `UsersDataGrid` renders using `DataGrid_Abstract` structure with customized slot content. The framework walks the JavaScript prototype chain to find parent templates automatically.

## Slot Forwarding (Advanced Pattern)

**Slot forwarding** allows middle-layer components to pass slots from their parent to their children. This enables deep component composition where the top-level component defines slot content that renders in a deeply nested child.

### The Problem

Consider a 3-layer architecture:
- **ComponentA** - Defines slot content (presentation logic)
- **ComponentB** - Middle layer (coordination/logic)
- **ComponentC** - Leaf component (rendering)

ComponentA wants to define how rows render, but ComponentC does the actual iteration. ComponentB sits in the middle.

### The Solution: Wrap Parent's content() Call

ComponentB forwards ComponentA's slot by defining a **new slot** that calls the parent's `content()`:

**ComponentA (Top Level - Defines Slot):**
```jqhtml
<Define:ComponentA>
  <ComponentB>
    <Slot:row>
      <div class="alert alert-success">
        Row from ComponentA: <strong><%= row.name %></strong>
      </div>
    </Slot:row>
  </ComponentB>
</Define:ComponentA>
```

**ComponentB (Middle Layer - Forwards Slot):**
```jqhtml
<Define:ComponentB>
  <ComponentC>
    <Slot:row>
      <%= content('row', row); %>
    </Slot:row>
  </ComponentC>
</Define:ComponentB>
```

**ComponentC (Leaf - Renders Slot):**
```jqhtml
<Define:ComponentC>
  <% for (let row of this.data.rows) { %>
    <%= content('row', row); %>
  <% } %>
</Define:ComponentC>
```

**Flow:**
1. ComponentA defines how rows should look
2. ComponentB receives that slot from parent
3. ComponentB creates a **new slot** for ComponentC that wraps the parent's `content('row', row)` call
4. ComponentC iterates and calls `content('row', row)`, which executes the chain back to ComponentA's original slot definition

### Real-World Example: DataGrid Architecture

**Top-level component defines presentation:**
```jqhtml
<ContactsDataGrid>
  <Slot:row>
    <td><%= row.id %></td>
    <td><%= row.name %></td>
    <td><%= row.email %></td>
  </Slot:row>
</ContactsDataGrid>
```

**DataGrid_Abstract (middle layer) handles pagination/filtering:**
```jqhtml
<Define:DataGrid_Abstract class="card">
  <CardHeader>
    <%= content('DG_CardHeader') %>
  </CardHeader>

  <div class="card-body">
    <DataGrid_Body
      $page="<%= this.data.page %>"
      $per_page="<%= this.data.per_page %>">
      <Slot:row>
        <%= content('row', row); %>
      </Slot:row>
    </DataGrid_Body>
  </div>
</Define:DataGrid_Abstract>
```

**DataGrid_Body (leaf) renders table:**
```jqhtml
<Define:DataGrid_Body>
  <table class="table">
    <tbody>
      <% for (let row of this.data.rows) { %>
        <tr>
          <%= content('row', row); %>
        </tr>
      <% } %>
    </tbody>
  </table>
</Define:DataGrid_Body>
```

**Benefits:**
- **Separation of concerns**: Each layer has a single responsibility
- **Reusability**: DataGrid_Body can be used by any parent
- **Flexibility**: Top-level defines presentation without knowing table rendering details
- **Composition**: Mix and match layers (swap DataGrid_Body for DataGrid_Body_Virtual_Scroll)

### Forwarding Multiple Slots

You can forward multiple slots simultaneously:

```jqhtml
<Define:MultiSlotMiddle>
  <MultiSlotChild>
    <Slot:header>
      <%= content('header', header); %>
    </Slot:header>

    <Slot:row>
      <%= content('row', row); %>
    </Slot:row>

    <Slot:footer>
      <%= content('footer', footer); %>
    </Slot:footer>
  </MultiSlotChild>
</Define:MultiSlotMiddle>
```

Each slot maintains its own context and parameters.

### Key Concepts

1. **Slots are composable** - You can wrap `content()` calls in new slot definitions
2. **Parameters flow through** - The `row` parameter passes from child → middle → parent
3. **No new syntax needed** - Uses existing slot and content() features
4. **Unlimited depth** - Can forward through any number of layers
5. **Each layer sees parent's content()** - Middle components have access to their parent's slot functions

### When to Use Slot Forwarding

**✅ Use for:**
- Multi-layer component architectures (Abstract → Concrete → Renderer)
- Separating data fetching from presentation logic
- Creating reusable middle-layer components that don't know about specific rendering

**❌ Don't use for:**
- Simple 2-layer parent-child relationships (direct slots work fine)
- When the middle component needs to modify slot content (use template inheritance instead)

## Reserved Words

**Slot names cannot be JavaScript reserved words** (`function`, `if`, `for`, `return`, `class`, etc.) - the parser will reject templates with fatal error.

This prevents runtime errors from invalid JavaScript identifiers.

## Critical Rules

### All or Nothing

**If a component uses ANY slots, ALL content must be in slots:**

```jqhtml
<!-- ❌ WRONG - Mixing slotted and non-slotted content -->
<Card>
  <Slot:header>Title</Slot:header>
  <p>This won't work</p>  <!-- Error: content outside slots -->
</Card>

<!-- ✅ CORRECT - All content in slots -->
<Card>
  <Slot:header>Title</Slot:header>
  <Slot:body><p>Content</p></Slot:body>
</Card>
```

### Slot Names Must Match

```jqhtml
<Define:Panel>
  <%= content('header') %>  <!-- Expects "header" slot -->
  <%= content('body') %>    <!-- Expects "body" slot -->
</Define:Panel>

<Panel>
  <Slot:header>Title</Slot:header>   <!-- ✅ Matches -->
  <Slot:body>Content</Slot:body>     <!-- ✅ Matches -->
  <Slot:footer>Oops</Slot:footer>    <!-- ❌ No matching slot in template -->
</Panel>
```

## Complex Example

```jqhtml
<Define:UserDashboard>
  <div class="dashboard">
    <Header $title="User Management">
      <Slot:actions>
        <button @click=this.add_user>Add User</button>
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
            <button @click=this.edit_user>Edit</button>
          </td>
        </Slot:row>

        <Slot:empty>
          <tr><td colspan="3">No users found</td></tr>
        </Slot:empty>
      </UserTable>
    <% } %>
  </div>
</Define:UserDashboard>
```

## Slots vs content()

### Simple content() (Most Common)

```jqhtml
<Define:Panel>
  <div class="panel">
    <%= content() %>
  </div>
</Define:Panel>

<Panel>
  <p>Simple content</p>
</Panel>
```

**Use when**: Single content area needed

### Named Slots (Advanced)

```jqhtml
<Define:Panel>
  <div class="panel">
    <div class="header"><%= content('header') %></div>
    <div class="body"><%= content('body') %></div>
    <div class="footer"><%= content('footer') %></div>
  </div>
</Define:Panel>

<Panel>
  <Slot:header>Title</Slot:header>
  <Slot:body><p>Body content</p></Slot:body>
  <Slot:footer>Footer</Slot:footer>
</Panel>
```

**Use when**: Multiple distinct content areas needed. When using named slots, ALL content must be in `<Slot:>` tags.

## Accessing Slot Content in JavaScript

```javascript
class Panel extends Jqhtml_Component {
  on_ready() {
    // Access rendered content
    const header = this.$sid('header');
    const body = this.$sid('body');

    // Slots are already rendered into DOM
    console.log(header.html());
  }
}
```

**Note**: Slots are template-time constructs - by the time JavaScript runs, they're already rendered into the DOM.

## Key Concepts

1. **Slots = named content areas** - Multiple distinct placement zones
2. **Most components don't need slots** - Use `content()` for single area
3. **All or nothing rule** - Can't mix slotted/non-slotted content
4. **Slot names must match** - Component expects specific slot names
5. **Default slot = unnamed content** - Accessed with `content()`
6. **Template-time feature** - Slots compile away before runtime
7. **Use for complex layouts** - Tables, dialogs, multi-section cards
8. **<Slot:name> syntax** - Opening and closing tags for slot content
