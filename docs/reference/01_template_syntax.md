# JQHTML Template Syntax

## Overview

JQHTML templates compile to JavaScript functions that return a markup buffer of instructions. No JSX transformer, no runtime parsing - just build-time compilation to efficient jQuery-based rendering.

## Basic Component Definition

```jqhtml
<Define:ComponentName>
  <div>Hello World</div>
</Define:ComponentName>
```

### Custom Tag Name

```jqhtml
<Define:ComponentName tag="span">
  Content rendered as &lt;span&gt; instead of &lt;div&gt;
</Define:ComponentName>
```

## String Interpolation

### Escaped Output (Default)

```jqhtml
<Define:UserCard>
  <div><%= this.data.user_name %></div>
</Define:UserCard>
```

**HTML is automatically escaped**:
```javascript
this.data.user_name = "<script>alert('xss')</script>";
// Renders as: &lt;script&gt;alert('xss')&lt;/script&gt;
```

### Unescaped Output (Raw HTML)

**⚠️ WARNING: Only use with trusted content**

```jqhtml
<Define:RichText>
  <div><%!= this.data.html_content %></div>
</Define:RichText>
```

**Use cases for unescaped output**:
- Rendering rich text from WYSIWYG editors (after server-side sanitization)
- Displaying pre-sanitized HTML from your backend
- Including SVG markup
- Embedding pre-rendered component HTML

**NEVER use `<%!= %>` with user input directly**:
```jqhtml
<%-- ❌ DANGEROUS - XSS vulnerability --%>
<div><%!= this.args.user_comment %></div>

<%-- ✅ SAFE - HTML escaped --%>
<div><%= this.args.user_comment %></div>

<%-- ✅ SAFE - Server-sanitized HTML --%>
<div><%!= this.data.sanitized_html %></div>
```

### BR Output (Escaped + Newlines to BR)

For user-entered text with line breaks (comments, descriptions, etc.), use `<%br= %>`:

```jqhtml
<Define:CommentDisplay>
  <div class="comment">
    <%br= this.data.comment_text %>
  </div>
</Define:CommentDisplay>
```

**How it works**:
- HTML is escaped (safe, like `<%= %>`)
- Newline characters (`\n`) are converted to `<br />` tags

The compiler emits a call to `jqhtml.escape_html_nl2br(value)`, a public export alongside
`escape_html()`. Escaping happens FIRST (via `textContent`/`innerHTML`, so it follows the
browser's own rules), and only then are newlines replaced — which is why the injected
`<br />` survives while any `<br>` the user typed does not. Both functions live in
`packages/core/src/escape.ts`, are exported from the package, and can be called directly
when building markup outside a template.

```javascript
this.data.comment_text = "Line 1\nLine 2\nLine 3";
// Renders as: Line 1<br />Line 2<br />Line 3
// (displayed as 3 separate lines in browser)
```

**Use cases**:
- User comments and descriptions
- Multi-line text fields
- Any text where visual line breaks are needed

### Property Access

```jqhtml
<div><%= this.data.items[i] %></div>
<div><%= this.args.title %></div>
<div><%= this.config.theme %></div>
```

### Output Syntax Summary

| Syntax | Escaping | Use Case |
|--------|----------|----------|
| `<%= %>` | **Escaped** | Default - use for all untrusted content |
| `<%!= %>` | **Unescaped** | Only for pre-sanitized HTML |
| `<%br= %>` | **Escaped + nl2br** | User text with line breaks (comments, descriptions) |
| `<% %>` | **No output** | Control flow (loops, conditionals, assignments) |

### What a Value Prints

The three output forms treat a value by its type:

| Value | Prints |
|-------|--------|
| `null`, `undefined` | Nothing |
| String, number, boolean | The value, escaped per the form (`<%!= %>` raw) |
| An array | The literal text `(Array)` - always, in all three forms |
| `content()` / `content('name', ...)` | The caller's markup, spliced in (`''`, printing nothing, when the caller supplied nothing) |
| Any other object | The object printer chain (see `22_value_printers_and_dynamic_tags.md`); throws if unhandled |

Arrays print `(Array)` so that data can never be mistaken for markup: an array of strings
from `this.data` is never spliced into the page as HTML. Join or loop over it instead:

```jqhtml
<Define:TagList>
  <span><%= this.data.tags.join(', ') %></span>
  <% for (const tag of this.data.tags) { %><b><%= tag %></b><% } %>
</Define:TagList>
```

## Control Flow

JQHTML uses JavaScript brace style for control flow:

### For Loops

```jqhtml
<% for (let item of this.data.items) { %>
  <div><%= item.name %></div>
<% } %>
```

### If Statements

```jqhtml
<% if (this.data.count > 0) { %>
  <div>Items: <%= this.data.count %></div>
<% } else { %>
  <div>No items</div>
<% } %>
```

### Ternary in Interpolation

```jqhtml
<div class="<%= this.data.active ? 'active' : 'inactive' %>">
  <%= this.data.active ? 'Online' : 'Offline' %>
</div>
```

## Comments

```jqhtml
<%-- This is a template comment, won't appear in output --%>

<Define:Component>
  <%-- Explain component purpose --%>
  <div>Content</div>
</Define:Component>
```

### `//` Line Comments Inside Code Blocks

Inside `<% %>` code blocks and `<%= %>` / `<%!= %>` expressions, `//` is a JavaScript line comment and is stripped before compiling. A comment always runs to the end of its line: nothing after the `//` is parsed, so a `%>` inside the comment does not close the tag. Close the tag on the next line, or use `/* */`. Inside an attribute value only `/* */` works, because an expression there must stay on one line (see below):

```jqhtml
<%
// this line is a comment and is stripped - it may mention <% %>
let x = 5; // so is this
%>
<% let y = 1; // note
%> <b>shown</b>
<div><%= x + y /* label */ %></div>
```

```jqhtml expect-error
<Define:Broken>
  <% let y = 1; // note %> <b>not shown: still inside the code block</b>
</Define:Broken>
```

When a template fails to compile because a `//` comment hid a `%>`, the error names that `%>` and the comment's line and column. If a later `%>` closes the block into valid code, the template compiles and the text between is part of the comment or the code. `//` inside strings, template literals and regex literals is not a comment.

**Not interchangeable with `<%-- --%>`:**
- `//` comments only work inside `<% %>` and `<%= %>` (JS scope)
- `<%-- --%>` template comments work anywhere in markup, including outside code blocks

## Whitespace and Formatting

Whitespace **between elements** is collapsed, like HTML - it is not preserved as written. Whitespace **inside a text node** is preserved.

**Rules:**

1. **Whitespace between elements collapses to a single space** - any run of spaces, tabs, and newlines between tags becomes one space
2. **Minified markup (no space) is respected** - tags with no whitespace between them stay adjacent
3. **Leading/trailing spaces inside a text node are preserved**

```jqhtml
<span>A</span> <span>B</span>
<!-- Renders as: <span>A</span> <span>B</span> (space preserved) -->

<span>A</span>     <span>B</span>
<!-- Renders as: <span>A</span> <span>B</span> (multiple spaces collapse to one) -->

<span>Line1</span>
<span>Line2</span>
<!-- Renders as: <span>Line1</span> <span>Line2</span> (newline collapses to one space) -->

<span>A</span><span>B</span>
<!-- Renders as: <span>A</span><span>B</span> (no space added - minified markup respected) -->

<span> hello </span>
<!-- Renders as: <span> hello </span> (leading/trailing text-node spaces kept) -->
```

So an indented multi-line template like this:

```jqhtml
<Define:BlockComponent>
  <div>
    <p>Indented content</p>
  </div>
</Define:BlockComponent>
```

renders with the indentation/newlines between `<div>` and `<p>` collapsed to a single space, not preserved verbatim - functionally identical to `<div> <p>Indented content</p> </div>`.

**See also:** `tests/whitespace-preservation/README.md` for the full set of documented cases.

## Complex Examples

### Nested Loops

```jqhtml
<Define:Table>
  <table>
    <% for (let row of this.data.rows) { %>
      <tr>
        <% for (let cell of row.cells) { %>
          <td><%= cell %></td>
        <% } %>
      </tr>
    <% } %>
  </table>
</Define:Table>
```

### Conditional Rendering with Loops

```jqhtml
<Define:UserList>
  <% if (this.data.users.length > 0) { %>
    <ul>
      <% for (let user of this.data.users) { %>
        <li><%= user.name %> - <%= user.email %></li>
      <% } %>
    </ul>
  <% } else { %>
    <p>No users found</p>
  <% } %>
</Define:UserList>
```

### Complex Expressions

```jqhtml
<Define:StatusBadge>
  <span class="badge <%= this.data.status_id === 1 ? 'bg-success' : 'bg-danger' %>">
    <%= this.data.status_label || 'Unknown' %>
  </span>
</Define:StatusBadge>
```

## Character References in Attribute Values

A quoted attribute value means what it means in static HTML. Character references in
the literal text are resolved by the compiler, following the HTML parser's rules, so the
value is the same on every path: a plain tag, a tag with `@event` or `$sid`, a component
attribute, a `$` arg and a `<Define>` default.

```jqhtml
<a title="Tom &amp; Jerry" href="?a=1&copy=2">...</a>
<!-- title is "Tom & Jerry"; href keeps "&copy=2" literal, as browsers do -->

<UserCard $label="&nbsp;" style="content: &quot;x&quot;" />
<!-- this.args.label is "\u00a0" (a no-break space); the style holds content: "x" -->
```

- Named references with or without `;` (`&amp;`, `&copy`), and numeric ones (`&#39;`,
  `&#x27;`) are resolved. A reference without `;` that is followed by `=` or a letter
  or digit stays literal (`&copy=2`), the historical attribute rule.
- `"` inside a single-quoted value, and `'` inside a double-quoted one, need no escaping.
  A backslash has no meaning in HTML attribute values; `title="a\"b"` is a compile error.
- Interpolated values are taken literally: in `title="<%= x %>"`, entity text inside `x`
  is not decoded (`x = "&lt;"` gives the attribute `&lt;`). Only the template's literal
  text around the expression is resolved.
- Element text (between tags) is left for the browser to resolve, as before.

## Conditional Attributes

Sometimes you need to conditionally include attributes based on runtime conditions. JQHTML supports PHTML-style conditional attribute syntax:

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
- Conditional blocks can appear in the ATTRIBUTE LIST, between attributes
- Attributes inside conditionals are included/excluded at runtime
- Boolean attributes (disabled, checked, etc.) work directly as conditional attributes
- A `<% %>` block may NOT appear inside a quoted attribute VALUE - the parser
  rejects `class="base <% if (x) { %>extra<% } %>"`. For a conditional class,
  add it from JavaScript instead: `<% if (x) { this.$.addClass('extra'); } %>`

**Common use cases**:
```jqhtml
<%-- Conditional classes (in-string) --%>
<div class="base-class <% if (this.data.active) { %>active<% } %> <% if (this.data.highlighted) { %>highlighted<% } %>">

<%-- Conditional data attributes --%>
<input
  type="text"
  <% if (this.args.user_id) { %>
    data-user-id="<%= this.args.user_id %>"
  <% } %>
>

<%-- Conditional boolean attributes --%>
<input
  type="checkbox"
  <% if (this.data.is_checked) { %>checked<% } %>
  <% if (this.args.readonly) { %>readonly<% } %>
>
```

**Note**: This is production-ready but typically you'd handle most conditional logic in your component data/args structure. Use when you need PHTML-style flexibility.

---

## @ Event Binding

Bind DOM events directly in templates using `@` attributes:

```jqhtml
<Define:Button>
  <button @click=this.handle_click>
    <%= this.args.label %>
  </button>
</Define:Button>
```

**Common events**:
```jqhtml
<input @change=this.handle_change @focus=this.handle_focus />
<form @submit=this.handle_submit>
<div @mouseover=this.handle_hover @mouseout=this.handle_leave>
<button @click=this.handle_click>
```

**Implementation**:
```javascript
class Button extends Jqhtml_Component {
  on_ready() {
    // Events are automatically bound by the framework
    // Just define the handler methods
  }

  handle_click(event) {
    console.log('Button clicked!', event);
    // Access component: this.data, this.args, this.$
  }
}
```

**Supported event types**:
- Mouse: `@click`, `@dblclick`, `@mouseover`, `@mouseout`, `@mouseenter`, `@mouseleave`
- Form: `@submit`, `@change`, `@input`, `@focus`, `@blur`
- Keyboard: `@keydown`, `@keyup`, `@keypress`
- Other: Any standard DOM event name works

---

## Define Tag Configuration

The `<Define>` tag supports configuration attributes that affect template behavior:

### extends Attribute

Specify a parent template for inheritance:

```jqhtml
<Define:UsersDataGrid extends="DataGrid_Abstract">
  <%-- Child template inherits parent structure --%>
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

**How it works**:
- Child slots (`<Slot:header>`, `<Slot:row>`) are inserted into parent template's `content('header')` calls
- Parent template structure wraps child slot content
- Allows template-only inheritance without JavaScript class

### $ Attribute Defaults (defineArgs)

Set default values for `$` attributes on the Define tag:

```jqhtml
<Define:DataGrid
    $per_page=25
    $sortable=true
    $ajax_endpoint="https://api.example.com/data"
    class="card">
  <%-- Template can use this.args.per_page, this.args.sortable, etc. --%>
  <div>Showing <%= this.args.per_page %> items</div>
</Define:DataGrid>
```

**Syntax**:
- **Quoted values**: `$endpoint="http://api.com"` → String literal
- **Unquoted values**: `$count=25` → JavaScript expression (number)
- **Unquoted references**: `$handler=MyController.fetch` → JavaScript reference

**Use case**: Component configuration without backing JavaScript class - template-only components with sensible defaults.

**Inheritance**: a child `<Define extends="DataGrid">`, or a JS subclass of `DataGrid`, that
does not set `$per_page` itself gets `DataGrid`'s `25`. The nearest `<Define>` in the chain
that sets an arg wins. See "Default Arguments (defineArgs)" in `02_component_definition.md`.

---

## Template Limitations

### Expressions Cannot Form an Entire Attribute List

An expression cannot dynamically produce a whole attribute (name and value) for a tag:

```jqhtml
<!-- WRONG -->
<th <%= column.width ? `style="width: ${column.width};"` : '' %>>

<!-- CORRECT - expression INSIDE an attribute value -->
<th style="<%= column.width ? 'width: '+column.width+'px' : '' %>">
```

**Why:** The parser cannot distinguish a `>` that closes the tag from a `>` that appears inside a JavaScript expression. Keep expressions inside attribute values (as shown in [Conditional Attributes](#conditional-attributes)), not as a stand-in for the whole attribute.

### Unquoted `<%= %>` Is Not a Valid Attribute Value

An attribute cannot be assigned directly to a `<%= %>` block - the interpolation must be inside quotes:

```jqhtml
<!-- WRONG -->
<Component foo=<%= bar() %> />
<Component $foo=<%= bar() %> />

<!-- CORRECT - quote the interpolated value -->
<Component foo="<%= bar() %>" />
<Component $foo="<%= bar() %>" />

<!-- CORRECT for $ attributes - use a literal JavaScript expression instead -->
<Component $foo=bar() />
```

### `<%= %>` in an Attribute Value Stays on One Line

A `<%= %>` or `<%!= %>` expression inside a quoted attribute value must open and close on
the same line; spanning lines is a compile error. Literal text in the value may still span
lines.

For a `$` attribute, use the bracketed form, which takes JavaScript directly, may span
lines and gives the same value:

```jqhtml expect-error
<Define:Role_Picker_Wrong>
  <Select_Input $options="<%= JSON.stringify([
    {value: 1, label: 'Member'},
  ]) %>" />
</Define:Role_Picker_Wrong>
```

```jqhtml
<Define:Role_Picker>
  <Select_Input $options=(JSON.stringify([
    {value: 1, label: 'Member'},
  ])) />
</Define:Role_Picker>
```

For a regular attribute, compute the value first in a `<% %>` block:

```jqhtml
<Define:Full_Name_Badge>
  <% const full_name = this.data.first + ' ' + this.data.last; %>
  <b title="<%= full_name %>">...</b>
</Define:Full_Name_Badge>
```

## Advanced: Dynamic Component Tags and Object Interpolation

Two capabilities for the uncommon case where data, not the template author, decides what
renders. `<{expression} />` mounts the component whose name the expression evaluates to,
under the same naming rule as a literal tag, and `<%= %>` can render an object through a
registered value printer. Both are documented in `22_value_printers_and_dynamic_tags.md`;
prefer literal tags and primitive interpolation whenever they suffice.

## Key Syntax Rules

1. **Component names**: Must start with a capital letter, optionally preceded by a single underscore (e.g., `UserCard`, `ProductList`, `_RootLayout`). The underscore prefix is reserved for framework-provided components; `__Foo` is not a component name and `_foo` is an HTML tag
2. **Escaped output**: `<%= expression %>` (HTML-escaped - default, safe)
3. **Unescaped output**: `<%!= expression %>` (Raw HTML - use with caution)
4. **Control flow**: `<% code %>` (no output) - Use JavaScript brace style `{ }`
5. **Comments**: `<%-- comment --%>`
6. **this context**: Always use `this.data`, `this.args`, etc.
7. **Default is safe in content**: `<%= expression %>` used as template content (between tags) escapes HTML unless you explicitly use `<%!= %>`. **Exception:** interpolation embedded inside a quoted attribute value (e.g. `title="<%= x %>"` or `$title="<%= x %>"`) is built as a raw JavaScript string and is NOT HTML-escaped at that point - escaping only happens if/when that value is later rendered through `<%= %>` in template content. Character references in the literal text of a quoted attribute value are resolved as in HTML (see Character References in Attribute Values). See `03_dollar_attribute_system.md` for details on `$` attribute interpolation.
8. **Event binding**: `@click=this.method` - Bind DOM events directly
9. **Conditional attributes**: `<% if (...) { %>attr="value"<% } %>` - PHTML-style
10. **Template inheritance**: `extends="ParentName"` on `<Define>` tag
11. **Default args**: `$property=value` on `<Define>` tag

## What Gets Compiled

Templates compile to a JavaScript render function that pushes a flat sequence of instructions:

```javascript
// This template:
<Define:Simple>
  <div><%= this.data.value %></div>
</Define:Simple>

// Compiles to something like:
render: function(data, args, content, jqhtml) {
  let _output = new jqhtml.Markup(this);
  _output.p({tag: ["div", {}, false]});
  _output.p(jqhtml.escape_html(this.data.value));
  _output.p("</div>");
  return _output;
}
```

**Markup buffer format:** each render, content and slot function creates its own
`jqhtml.Markup` buffer, appends instructions with `p()`, and returns it. The buffer records
the component whose template wrote it (the definer).
- `{tag: ["element", {attributes}, self_closing]}` - Create element
- Plain strings - Text content or closing tags (`"</div>"`)
- `jqhtml.escape_html(value)` - Escaped interpolation
- `{comp: [name, props, content_function | slots]}` - Component invocation; content and slot functions return their own buffer
- A buffer spliced by `content()` - rendered in its definer

The instruction format is internal - developers write templates, the compiler handles the rest.
