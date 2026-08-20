# Content & Slots

Components can receive content from their parent. The `content()` function renders passed content. Named slots allow multiple distinct content areas.

## Basic Content

Use `content()` to render content passed between component tags:

**Definition:**

```jqhtml
<Define:Panel class="panel">
  <div class="panel-header"><%= this.args.title %></div>
  <div class="panel-body">
    <%= content() %>
  </div>
</Define:Panel>
```

**Usage:**

```jqhtml
<Panel $title="Settings">
  <p>Panel content goes here</p>
  <button>Save</button>
</Panel>
```

**Output:**

```html
<div class="Panel Component panel">
  <div class="panel-header">Settings</div>
  <div class="panel-body">
    <p>Panel content goes here</p>
    <button>Save</button>
  </div>
</div>
```

## Self-Closing Components

Components without content use self-closing syntax:

```jqhtml
<UserCard $user_id="123" />
```

Components with content use opening/closing tags:

```jqhtml
<Panel $title="Info">
  <p>Content here</p>
</Panel>
```

## Named Slots

For multiple content areas, use named slots.

**Definition:**

```jqhtml
<Define:Card class="card">
  <div class="card-header">
    <%= content('header') %>
  </div>
  <div class="card-body">
    <%= content('body') %>
  </div>
  <div class="card-footer">
    <%= content('footer') %>
  </div>
</Define:Card>
```

**Usage:**

```jqhtml
<Card>
  <Slot:header>
    <h3>User Profile</h3>
  </Slot:header>

  <Slot:body>
    <p>Main content here</p>
  </Slot:body>

  <Slot:footer>
    <button>Save</button>
  </Slot:footer>
</Card>
```

**Important:** When using named slots, ALL content must be in a `<Slot:>` tag. You cannot mix named slots with loose content. Either use `content()` alone (simple case) or all `content('name')` (named slots).

## Passing Data to Slots

Parent components can pass data to slots:

**Definition:**

```jqhtml
<Define:DataTable class="table">
  <thead>
    <tr><%= content('header') %></tr>
  </thead>
  <tbody>
    <% for (let record of this.data.records) { %>
      <tr><%= content('row', record) %></tr>
    <% } %>
  </tbody>
</Define:DataTable>
```

**Usage:**

```jqhtml
<DataTable>
  <Slot:header>
    <th>ID</th>
    <th>Name</th>
  </Slot:header>

  <Slot:row>
    <td><%= row.id %></td>
    <td><%= row.name %></td>
  </Slot:row>
</DataTable>
```

The parameter name (`row`) matches the slot name. Each iteration passes the current record.

## All or Nothing Rule

If using any named slots, all content must be in slots:

```html
<!-- Wrong: mixing slotted and non-slotted -->
<Card>
  <Slot:header>Title</Slot:header>
  <p>Loose content</p>  <!-- Error - not in a slot -->
</Card>

<!-- Correct: all content in named slots -->
<Card>
  <Slot:header>Title</Slot:header>
  <Slot:body><p>Body content</p></Slot:body>
</Card>
```

## Complex Example

**UserTable definition:**

```jqhtml
<Define:UserTable class="table">
  <thead>
    <tr><%= content('header') %></tr>
  </thead>
  <tbody>
    <% for (let user of this.args.users) { %>
      <tr><%= content('row', user) %></tr>
    <% } %>
  </tbody>
</Define:UserTable>
```

**Usage with slots:**

```jqhtml
<Define:UserDashboard>
  <PageHeader>
    <Slot:title>Users</Slot:title>
    <Slot:actions>
      <button @click=this.add_user>Add User</button>
    </Slot:actions>
  </PageHeader>

  <UserTable $users=this.data.users>
    <Slot:header>
      <th>ID</th>
      <th>Name</th>
      <th>Actions</th>
    </Slot:header>

    <Slot:row>
      <td><%= row.id %></td>
      <td><%= row.name %></td>
      <td><UserRowActions $user_id=row.id /></td>
    </Slot:row>
  </UserTable>
</Define:UserDashboard>
```

The `<Slot:header>` content renders where `content('header')` is called. The `<Slot:row>` content renders for each iteration, with `row` available because the slot is named `row`.

Note what the page template does *not* contain: no layout classes, no repeated button
markup, no title styling. `PageHeader` owns the header's arrangement and `UserRowActions`
owns the per-row controls, so this template reads as a list of concepts. That is the
practice covered in [Semantic Design](../17-semantic-design/).

## Slot-Based Inheritance

Use `extends=""` on the Define tag to inherit another component's template structure while providing your own slot content:

**Parent template:**

```jqhtml
<Define:DataGrid_Abstract class="table">
  <thead><tr><%= content('header') %></tr></thead>
  <tbody>
    <% for (let record of this.data.records) { %>
      <tr><%= content('row', record) %></tr>
    <% } %>
  </tbody>
</Define:DataGrid_Abstract>
```

**Child extends parent:**

```jqhtml
<Define:UsersDataGrid extends="DataGrid_Abstract">
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

The `extends="DataGrid_Abstract"` attribute tells the framework to use DataGrid_Abstract's template structure, with UsersDataGrid's slots filling in the content areas.

**Note:** Template inheritance can also occur via JavaScript class inheritance (`class UsersDataGrid extends DataGrid_Abstract`). If both a `.jqhtml` template and `.js` class exist for a component, keep their inheritance chains consistent — the framework does not validate or error if they diverge, so a mismatch is silently resolved rather than flagged. See [Template Inheritance](../13-template-inheritance/) for details.

## When to Use Slots

| Scenario | Approach |
|----------|----------|
| Single content area | `content()` |
| Header/body/footer layout | Named slots |
| Data table rows | Slots with data passing |
| Simple wrapper | `content()` |

Most components (95%) only need `content()`. Use slots when you need multiple distinct content areas.

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/reference/05_component_nesting_and_content.md` - content() function
- `docs/reference/06_slot_system.md` - Named slots and inheritance

### Last Updated
2026-08-18

### Editorial Notes
- Started with simple content() before introducing slots
- Data passing to slots is a key pattern worth highlighting
- Slot-based inheritance mentioned briefly with link to dedicated chapter
- "All or nothing" rule is important gotcha
- Slot forwarding omitted - too advanced for main docs
- Server-rendered _inner_html omitted - covered in server integration chapter
- 2026-08-18: Revised the "Complex Example" to demonstrate semantic composition while still teaching slots. `<Header $title="Users">` became `<PageHeader>` with `<Slot:title>`/`<Slot:actions>` (the title is authored content, so it belongs in a slot, not an argument), and the inline `<button>Edit</button>` in the row slot became `<UserRowActions $user_id=row.id />`. The slot lesson is unchanged — the example now uses one more slotted component instead of one fewer. Left alone: the `Panel`/`Card`/`DataTable` definitions earlier in the chapter, which teach `content()` and named-slot mechanics and already own their own look inside their `<Define:>` blocks.
- 2026-07-21: Accuracy pass - softened the "inheritance chains must match" note; the framework does not actually validate/enforce this, it silently resolves via independent chain walks instead of erroring.
