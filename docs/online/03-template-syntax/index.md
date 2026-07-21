# Template Syntax

JQHTML templates compile to JavaScript at build time. This chapter covers the template language syntax.

## Component Definition

Define components with the `<Define:Name>` tag:

```jqhtml
<Define:UserCard>
  <h3>User Profile</h3>
  <p>Content here</p>
</Define:UserCard>
```

The component renders as a `<div>` by default. Change the element type with `tag`:

```jqhtml
<Define:NavLink tag="a" class="nav-link">
  <%= this.args.label %>
</Define:NavLink>
```

**Note:** HTML5 void elements (`<input>`, `<img>`, `<br>`, `<hr>`, `<meta>`, `<link>`, etc.) auto-close without a closing tag, same as in plain HTML. Components always require an explicit closing tag or self-closing syntax: `<UserCard>...</UserCard>` or `<UserCard />`.

## Interpolation

### Escaped Output (Safe)

Use `<%= %>` for HTML-escaped output:

```jqhtml
<Define:UserCard>
  <h3><%= this.data.name %></h3>
  <p><%= this.data.bio %></p>
</Define:UserCard>
```

HTML characters are automatically escaped:

```javascript
this.data.name = "<script>alert('xss')</script>";
// Renders as: &lt;script&gt;alert('xss')&lt;/script&gt;
```

### Unescaped Output (Use With Caution)

Use `<%!= %>` for raw HTML output:

```jqhtml
<Define:RichText>
  <div><%!= this.data.sanitized_html %></div>
</Define:RichText>
```

Only use `<%!= %>` with content you trust (server-sanitized HTML, SVG markup, etc.). Never use it with user input directly.

### BR Output (Escaped + Line Breaks)

Use `<%br= %>` for user text with line breaks:

```jqhtml
<Define:CommentDisplay>
  <div class="comment">
    <%br= this.data.comment_text %>
  </div>
</Define:CommentDisplay>
```

HTML is escaped (safe), and newline characters (`\n`) become `<br />` tags. Use for comments, descriptions, or any multi-line text where visual line breaks are needed.

### Interpolation Summary

| Syntax | Behavior | Use Case |
|--------|----------|----------|
| `<%= %>` | Escaped | All untrusted content (default) |
| `<%!= %>` | Unescaped | Pre-sanitized HTML only |
| `<%br= %>` | Escaped + nl2br | User text with line breaks |
| `<% %>` | No output | Control flow |

## Control Flow

Use JavaScript brace syntax for loops and conditionals.

### Conditionals

```jqhtml
<Define:StatusDisplay>
  <% if (this.data.online) { %>
    <span class="badge bg-success">Online</span>
  <% } else { %>
    <span class="badge bg-secondary">Offline</span>
  <% } %>
</Define:StatusDisplay>
```

### Loops

```jqhtml
<Define:UserList>
  <ul>
    <% for (let user of this.data.users) { %>
      <li><%= user.name %> - <%= user.email %></li>
    <% } %>
  </ul>
</Define:UserList>
```

### Nested Loops

```jqhtml
<Define:DataTable>
  <table>
    <% for (let row of this.data.rows) { %>
      <tr>
        <% for (let cell of row.cells) { %>
          <td><%= cell %></td>
        <% } %>
      </tr>
    <% } %>
  </table>
</Define:DataTable>
```

### Ternary Expressions

```jqhtml
<Define:StatusBadge>
  <span class="badge <%= this.data.active ? 'bg-success' : 'bg-danger' %>">
    <%= this.data.active ? 'Active' : 'Inactive' %>
  </span>
</Define:StatusBadge>
```

## Comments

Template comments are stripped from output:

```jqhtml
<Define:Example>
  <%-- This comment won't appear in rendered HTML --%>
  <div>Visible content</div>
</Define:Example>
```

Inside a `<% %>` code block, a `//` that starts the line (first non-whitespace content) works as a JavaScript line comment too:

```jqhtml
<%
// stripped before parsing
let x = 5;
%>
```

`//` only works inside code blocks; `<%-- --%>` works anywhere in markup.

## Event Binding

Bind DOM events with `@` attributes:

```jqhtml
<Define:Button>
  <button @click=this.handle_click>
    <%= this.args.label %>
  </button>
</Define:Button>
```

```javascript
class Button extends Jqhtml_Component {
  handle_click(event) {
    console.log('Clicked!');
  }
}
```

Common events:

```jqhtml
<input @change=this.on_change @focus=this.on_focus />
<form @submit=this.on_submit>
<div @mouseover=this.on_hover @mouseout=this.on_leave>
```

## Conditional Attributes

Add attributes conditionally within the tag:

```jqhtml
<Define:InputField>
  <input
    type="text"
    class="form-control"
    <% if (this.args.disabled) { %>disabled<% } %>
    <% if (this.args.required) { %>required<% } %>
  />
</Define:InputField>
```

Use a ternary inside `<%= %>` for dynamic classes. `<% %>` code blocks are not allowed inside attribute values - only `<%= %>`/`<%!= %>` expressions are:

```jqhtml
<Define:Alert>
  <div class="alert <%= this.args.dismissible ? 'alert-dismissible' : '' %>">
    <%= content() %>
  </div>
</Define:Alert>
```

## Default Arguments

Set default values for component parameters on the Define tag:

```jqhtml
<Define:Pagination
    $per_page=25
    $show_total=true
    class="pagination">
  <span>Showing <%= this.args.per_page %> per page</span>
  <% if (this.args.show_total) { %>
    <span>Total: <%= this.data.total %></span>
  <% } %>
</Define:Pagination>
```

Quoted values are strings, unquoted values are JavaScript expressions:

```jqhtml
<Define:Config
    $endpoint="https://api.example.com"
    $timeout=5000
    $retry=true>
</Define:Config>
```

## Template Inheritance

Extend another component's template with `extends`:

```jqhtml
<Define:UsersGrid extends="DataGrid">
  <Slot:header>
    <th>Name</th>
    <th>Email</th>
  </Slot:header>

  <Slot:row>
    <td><%= row.name %></td>
    <td><%= row.email %></td>
  </Slot:row>
</Define:UsersGrid>
```

The child's slots fill into the parent template's `content()` calls. See [Template Inheritance](../13-template-inheritance/) for details.

## Property Access

Access component data through `this`:

```jqhtml
<Define:Example>
  <%-- Arguments passed via $ attributes --%>
  <h3><%= this.args.title %></h3>

  <%-- Data loaded in on_load() --%>
  <p><%= this.data.description %></p>

  <%-- Array access --%>
  <span><%= this.data.items[0].name %></span>

  <%-- Default values --%>
  <span><%= this.data.label || 'Untitled' %></span>
</Define:Example>
```

## Syntax Reference

| Syntax | Purpose |
|--------|---------|
| `<Define:Name>` | Component definition |
| `tag="element"` | Root element type |
| `class="..."` | CSS classes on root |
| `<%= expr %>` | Escaped output |
| `<%!= expr %>` | Unescaped output |
| `<%br= expr %>` | Escaped + newlines to BR |
| `<% code %>` | JavaScript code |
| `<%-- text --%>` | Comment |
| `@event=handler` | Event binding |
| `$prop=value` | Default argument |
| `extends="Parent"` | Template inheritance |

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/official/01_template_syntax.md` - Complete template syntax reference

### Last Updated
2026-07-21

### Editorial Notes
- Organized from simple to complex: definition → interpolation → control flow → events → advanced
- Kept each section brief with one clear example
- Escaped vs unescaped output emphasized for security
- Event binding covered here rather than event handling chapter since it's template syntax
- Template inheritance mentioned briefly with link to dedicated chapter
- Omitted compilation internals (instruction arrays) per guidelines
- Conditional attributes shown but noted as advanced use case
- Accuracy pass: the "dynamic classes" example used a bare `<% if %>` block inside
  a quoted attribute value, which the lexer rejects (only `<%= %>`/`<%!= %>` are
  allowed inside attribute values) - replaced with the ternary form; fixed base
  class name to `Jqhtml_Component`; added a note distinguishing HTML5 void-element
  auto-closing from mandatory component closing tags
