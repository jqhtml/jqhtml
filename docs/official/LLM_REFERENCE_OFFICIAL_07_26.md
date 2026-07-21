# JQHTML Reference

> This section describes JQHTML, a component templating system. Include this block in project documentation when the project uses JQHTML.

---

## Overview

JQHTML is a component templating system built on jQuery. Components are jQuery objects with structured lifecycles. The DOM is the state—no virtual DOM, no state abstraction. Update elements directly via jQuery.

Packages: `@jqhtml/core` (runtime), `@jqhtml/parser` (compiler, ships the `jqhtml-compile` CLI), `@jqhtml/ssr` (server rendering), plus a VS Code extension (github.com/jqhtml/jqhtml-vscode). Repo: github.com/jqhtml/jqhtml.

## Components

A component can be:
- `.jqhtml` template only (markup, no behavior — no JS class needed; uses the default `Jqhtml_Component` class)
- `.js` class only (behavior, default template renders `content()`)
- Both template and JS (full component)
- Neither (undefined components render as `<div class="ComponentName Component">`)

Component names must start with a capital letter. JS class name must match template name exactly.

```jqhtml
<Define:UserCard class="card">
  <h3><%= this.data.name %></h3>
  <p><%= this.data.email %></p>
</Define:UserCard>
```

```javascript
import { Jqhtml_Component } from '@jqhtml/core';

class UserCard extends Jqhtml_Component {
  async on_load() {
    this.data = await fetch(`/api/users/${this.args.user_id}`).then(r => r.json());
  }
}
```

Usage: `<UserCard $user_id="123" />`

Naming: source code conventionally uses `Pascal_Snake_Case` (`User_Card`); docs may show `PascalCase` (`UserCard`). Both refer to the same thing. Filenames are `snake_case` (`user_card.jqhtml`).

## Compiling and Registering

Templates compile at build time — there is no runtime template parsing.

```bash
npx jqhtml-compile user_card.jqhtml --format esm   # formats: iife|esm|cjs|umd (default: iife)
```

Bundler users: `@jqhtml/vite-plugin` and `@jqhtml/esbuild-plugin` compile `.jqhtml` imports automatically (github.com/jqhtml/jqhtml-vite, github.com/jqhtml/jqhtml-esbuild).

```bash
```

- `iife` — self-executing, registers with `window.jqhtml` automatically
- `esm` / `cjs` / `umd` — module export; you register it yourself:

```javascript
import User_Card_Template from './user_card.jqhtml.js';
jqhtml.register(User_Card_Template);   // unified: auto-detects template or class

class UserCard extends Jqhtml_Component { }
jqhtml.register(UserCard);             // registers under the class name
```

Explicit forms: `jqhtml.register_template(template)` and `jqhtml.register_component(name, klass)`. The framework merges template and class by component name.

**If your build minifies class names**, define `static component_name = 'UserCard';` in the class so the name survives minification.

## Template Syntax

| Syntax | Purpose |
|--------|---------|
| `<Define:Name>` | Component definition |
| `tag="element"` | Root element type (default: div) |
| `class="..."` | CSS classes (merged from definition + invocation) |
| `extends="Parent"` | Template inheritance |
| `<%= expr %>` | HTML-escaped output |
| `<%!= expr %>` | Unescaped output (trusted content only) |
| `<%br= expr %>` | HTML-escaped output with `\n` converted to `<br />` (user-entered multiline text) |
| `<% code %>` | JavaScript control flow |
| `<%-- comment --%>` | Template comment (stripped) |
| `$attr=value` | Component parameter (accessible via `this.args.attr`) |
| `$sid="name"` | Scoped ID (access via `this.$sid('name')` / child instance via `this.sid('name')`) |
| `$redrawable` | Marks element for selective re-render via `this.render('sid')` |
| `@event=handler` | DOM event binding |
| `content()` | Render passed content |
| `content('name')` | Render named slot |
| `content('name', data)` | Render slot with data (variable name matches slot name) |
| `<Slot:name>` | Define named slot content |

### Quoted vs Unquoted $ Values

This distinction is critical:

```jqhtml
<Component $id="123" />     <%-- this.args.id = "123" (string) --%>
<Component $id=123 />       <%-- this.args.id = 123 (number) --%>
<Component $offset=-1 />    <%-- negative numbers work --%>
<Component $enabled=true /> <%-- this.args.enabled = true (boolean) --%>
<Component $user=this.data.user /> <%-- this.args.user = object reference --%>
<Component $max=Model.get_max('name') /> <%-- function call with string arg --%>
```

Quoted = string literal. Unquoted = JavaScript expression, but a **restricted grammar**, not full JS: no spaces, and operators, ternaries, comparisons, and object/array literals throw a compile error. Compute complex values in `<% %>` code first, or use a quoted `"<%= %>"` interpolation.

`$` attributes are in-memory only — they never appear as `data-*` attributes in the rendered DOM.

### Control Flow

Brace style only:

```jqhtml
<% if (this.data.active) { %>
  <span>Active</span>
<% } %>

<% for (let item of this.data.items) { %>
  <li><%= item.name %></li>
<% } %>
```

### Template Limitation

Expressions cannot be attribute values inside HTML tags:

```jqhtml
<%-- WRONG - parser cannot distinguish > in JS from > closing tag --%>
<th <%= column.width ? `style="width: ${column.width};"` : '' %>>

<%-- CORRECT - expression inside attribute value --%>
<th style="<%= column.width ? 'width: '+column.width+'px' : '' %>">
```

Void elements (`<input>`, `<img>`, `<br>`, `<hr>`) auto-close per HTML5. Components still need explicit self-closing: `<UserCard />`.

## Lifecycle

### Without on_load() (simple components, orchestrators)
```
on_create → render → on_render → on_ready
```

### With on_load() (data-fetching components)
```
on_create → render → on_render → on_load → on_loaded → [render if this.data changed] → [on_render if re-rendered] → on_ready
```

Full order: `create` → `render` → `on_render` → `load` → (`on_loaded`) → `ready`. Children boot in parallel; ready is bottom-up (all children complete `on_ready()` before the parent's runs).

`on_load()` is a **pure function** in the algebraic sense: `this.args` is input, `this.data` is output. Use it when a component needs to fetch data based on its input args.

| Hook | Async | Purpose |
|------|-------|---------|
| `on_create()` | No | Set defaults on `this.data`, initialize `this.state` |
| `on_render()` | No | Immediate post-render, child components exist but not ready yet |
| `on_load()` | Yes | Fetch data into `this.data` (triggers re-render if data changed) |
| `on_loaded()` | Yes | After `on_load()` completes, on the real component: `this.data` frozen, `this.$`/`this.state`/`this.args` accessible. Use to clone `this.data` into `this.state` for local manipulation |
| `on_ready()` | Yes | All children guaranteed ready, safe to hook/initialize |
| `on_stop()` | No | Cleanup (timers, connections) |

**Key timing differences:**
- `on_render()` - Child components exist in DOM but have NOT completed their lifecycle
- `on_ready()` - All child components have completed `on_ready()` themselves (bottom-up)

### this.data Freeze Cycle

1. `on_create()`: writable — set initial defaults here
2. After `on_create()`: **FROZEN** — modifying throws
3. Before each `on_load()`: **RESTORED** to the `on_create()` snapshot
4. During `on_load()`: **UNFROZEN** — the only place to load API data
5. After `on_load()`: **FROZEN** again; all other lifecycle methods see read-only data

### on_load() Restrictions

`on_load()` is enforced via Proxy. Accessing restricted properties throws errors:

- **Allowed:** `this.args` (read), `this.data` (read/write)
- **Throws error:** `this.$`, `this.$sid()`, `this.sid()`, `this.render()`, any DOM access

This enforces pure data-fetching. All DOM manipulation belongs in `on_ready()`.

### Double-Render Flow

1. `on_create()` sets `this.data` defaults
2. First render: template executes with default data (show loading state)
3. `on_load()` fetches and populates `this.data`
4. Second render (automatic, only if data changed): template re-executes with populated data
5. Children initialize and complete
6. `on_ready()` fires

```jqhtml
<Define:UserCard>
  <% if (!this.data.name) { %>
    <div class="loading">Loading...</div>
  <% } else { %>
    <h3><%= this.data.name %></h3>
  <% } %>
</Define:UserCard>
```

Never call `this.render()` inside `on_load()` — the framework watches `this.data` and re-renders automatically.

### gate_load() — Delay First Data Load

Register promises in `on_create()` that must settle before the component's FIRST `on_load()` runs. The initial render still paints immediately:

```javascript
on_create() {
  this.gate_load(window.auth_ready);  // on_load() waits for auth
}
```

One-shot: gates apply only to the first load; `reload()`/`refresh()`/`stop()` release them.

## State Properties

| Property | Purpose | Mutable |
|----------|---------|---------|
| `this.args` | Input parameters from `$` attributes. | Read-only in `on_load()`; modify elsewhere then call `reload()` |
| `this.data` | API-loaded data. Set in `on_load()`. | Only in `on_create()`/`on_load()`, **frozen elsewhere** |
| `this.state` | Local UI state. Framework ignores it completely. | Anywhere, anytime |

## Component Methods

| Method | Calls on_load() | Calls on_ready() | Redraws DOM | Purpose |
|--------|-----------------|------------------|-------------|---------|
| `load()` | Yes | No | No | Fetch-only: re-runs `on_load()`, updates `this.data`, no render. Returns `true` if data changed |
| `render(sid?)` | No | Yes | Always | Re-render with **current** data (no fetch). Returns a Promise resolving after the full render lifecycle (DOM update → children ready → `on_ready` → 'ready' event). Pass a `$sid` to re-render one `$redrawable` |
| `reload()` | Yes | Yes | Conditional | Re-fetch AND re-render — the standard update method. Debounced. Renders unless nothing changed after cache hydration + `on_load()` |
| `refresh()` | Yes | Conditional | Only if data changed | `refresh()` **is** `reload(false)`: re-fetches, but re-renders (and re-runs `on_ready()`) only if data changed. Use for polling/background sync without flicker. Shares the reload debounce queue; a queued `reload()` takes precedence |
| `ready(cb?)` | No | No | No | Promise (or callback) resolving when component completes its lifecycle |
| `rendered(cb?)` | No | No | No | Like `ready()` but resolves when the synchronous render chain completes, before the ready phase |
| `stop()` | No | No | No | Stop lifecycle before removal; calls `on_stop()`, fires 'stop' event, does NOT remove DOM |

`redraw()` is an alias for `render()`. `render()` and `redraw()` are legitimate public methods — the rule is not "never call render()", it is "never call render() inside `on_load()`".

**render() vs reload():** use `render()` when you've already updated `this.args`/`this.state` and just need the template to re-execute; use `reload()`/`refresh()` when you need fresh data from `on_load()`.

**reload() and refresh() are NOT aliases.** `reload()` always intends a re-render (skipped only when nothing changed after cache + load); `refresh()` = `reload(false)` re-renders only if data changed.

```javascript
// load() gives you manual control:
const changed = await this.load();
if (changed) await this.render();

// $redrawable targeting:
this.args.count++;
this.render('counter');  // re-renders only the element with $sid="counter" $redrawable
```

**Sync requirements:** `on_create()`, `on_render()`, `on_stop()`, `stop()` MUST be synchronous. `on_load()`, `on_loaded()`, `on_ready()` can be async.

**Invocation/hook pattern:** you call the unprefixed method (`render()`, `load()`); the framework runs your `on_` hook (`on_render()`, `on_load()`).

## Events

```javascript
component.on('ready', (component) => { ... });
component.once('loaded', (component) => { ... });   // fires exactly once
component.trigger('custom_event', data);
```

**Supported lifecycle events:** `create`, `render`, `rendered`, `load`, `loaded`, `ready`, `stop`.

**Sticky semantics:** if the event already occurred, `.on()`/`.once()` callbacks fire immediately. `.once()` on an already-fired event fires immediately and registers no listener. Both return `this` for chaining.

`stop()` nuance: when a component has NO `on_stop()` hook AND no `'stop'` listeners registered at the time `stop()` is called, a fast path skips the `_Component_Stopped` class and the event.

## jQuery Integration

- `this.$` — jQuery object for component root element (genuine jQuery — all methods work)
- `this.$sid('name')` — jQuery object for element with `$sid="name"` (rendered as `id="name:<parent _cid>"`)
- `this.sid('name')` — Child component instance with that `$sid`
- `$(element).component()` — Getter: returns component instance
- `$(element).component('Name', { args })` — Setter: creates component, returns jQuery object for chaining
- `this.$.shallowFind(sel)` — framework-added: searches downward but stops at first match per branch (won't reach into nested components)

## Content

Use `content()` to render content passed between component tags:

```jqhtml
<Define:Panel class="panel">
  <div class="panel-body">
    <%= content() %>
  </div>
</Define:Panel>

<Panel>
  <p>This content renders inside panel-body</p>
</Panel>
```

Most components (95%) only need `content()`.

### Named Slots

For complex abstract components (e.g., data grids) that need multiple distinct content areas, use named slots:

```jqhtml
<Define:Card>
  <div class="header"><%= content('header') %></div>
  <div class="body"><%= content('body') %></div>
</Define:Card>

<Card>
  <Slot:header><h3>Title</h3></Slot:header>
  <Slot:body><p>Content</p></Slot:body>
</Card>
```

**All-or-nothing rule:** once an invocation uses any `<Slot:>`, ALL content must be in `<Slot:>` tags — mixing slotted and unslotted content is unsupported.

Slots can receive data from the parent template:

```jqhtml
<Define:DataTable>
  <% for (let record of this.data.records) { %>
    <tr><%= content('row', record) %></tr>
  <% } %>
</Define:DataTable>

<DataTable>
  <Slot:row>
    <td><%= row.id %></td>  <%-- 'row' matches slot name --%>
  </Slot:row>
</DataTable>
```

Slot names cannot be JavaScript reserved words (compile error).

## Template Inheritance

Use `extends` to inherit another component's template structure:

```jqhtml
<Define:UsersGrid extends="DataGrid">
  <Slot:header><th>Name</th><th>Email</th></Slot:header>
  <Slot:row><td><%= row.name %></td><td><%= row.email %></td></Slot:row>
</Define:UsersGrid>
```

A parent template applies only when the child's template body is **slot-only** (nothing but `<Slot:>` tags at the top level). A body with any top-level HTML is used as-is. Lookup order: `extends=""` attribute, then the JS class prototype chain (a slot-only template inherits from the JS parent automatically). If both JS class and template specify inheritance, they must match.

**`tag` is NOT inherited** — each `<Define:>` sets its own `tag` or defaults to `div`.

## Caching (Opt-In, Stale-While-Revalidate)

**Nothing is cached by default.** Caching is opt-in localStorage caching, enabled app-wide with:

```javascript
jqhtml.set_cache_key('myapp_v1.2.3_user_456');           // 'data' mode (default): caches this.data
jqhtml.set_cache_key('myapp_v1.2.3_user_456', 'html');   // caches rendered HTML, can skip template execution
```

The key should include app build hash + user ID (cache auto-clears when it changes). Behavior on cache hit: instant render → `on_load()` revalidates in background → re-render if changed. Per-component cache identity is component name + `this.args`; override with a `cache_id()` method when args don't capture what matters.

## SSR

`@jqhtml/ssr` renders components server-side; the client hydrates with `await jqhtml.boot()`. A preload API (`jqhtml.start_data_capture()` / `get_captured_data()` / `set_preload_data(entries)` etc.) carries server-fetched data to the client. See `packages/ssr/README.md`.

## Event Binding

Template syntax for DOM events:

```jqhtml
<button @click=this.handle_click>Click</button>
<input @change=this.on_change />
<form @submit=this.on_submit>
```

Handler receives the native DOM event object.

## Parent-Child Communication

Pass callbacks via `$` attributes:

```jqhtml
<Define:Parent>
  <Child $on_action=this.handle_action />
</Define:Parent>
```

```javascript
class Child extends Jqhtml_Component {
  on_ready() {
    this.$sid('btn').on('click', () => this.args.on_action(this.data.id));
  }
}
```

## Component Documentation Standard

Document `.jqhtml` files with template comments:

```jqhtml
<%--
UserCard - Display user profile with avatar and status

ARGS:
    $user_id="123"  - User ID to fetch

DATA:
    this.data = {name, email, status, avatar_url}
--%>
<Define:UserCard>...</Define:UserCard>
```

## Common Mistakes

| Wrong | Right | Why |
|-------|-------|-----|
| `<Define:Button><div class="btn">` | `<Define:Button class="btn">` | Define IS the element |
| `<Define:Button><button>` | `<Define:Button tag="button">` | Use tag attribute |
| `this.data.x = y` in on_ready | Set in on_load only | this.data frozen outside on_create/on_load |
| `this.$sid()` in on_load | Move to on_ready | on_load has no DOM access (Proxy throws) |
| `await fetch()` in on_create | Move to on_load | on_create must be sync |
| `this.render()` in on_load | Let framework auto-render | Framework re-renders when this.data changes |
| `this.reload()` unconditionally in on_ready | Guard with flag | reload() triggers on_ready again = infinite loop |
| `refresh()` when a render is required | `reload()` | refresh() skips render when data unchanged |
| `<% if (x): %>...<% endif %>` | `<% if (x) { %>...<% } %>` | Brace style only; colon/endif was removed |
| `/* comment */` in .jqhtml | `<%-- comment --%>` | JQHTML uses template comment syntax |

## Orchestrator Pattern

For complex UIs managing subscriptions and coordinating children (e.g., realtime dashboards), use the **orchestrator pattern**:

**Key differences from standard pattern:**
- Does NOT use `on_load()` - manages data loading manually
- Uses `this.state` instead of `this.data` for dynamic content
- Re-renders via `render()` (no fetch needed — state is already in memory)
- Must guard against infinite loops since re-rendering triggers `on_ready()` again

```javascript
class Dashboard_Screen extends Jqhtml_Component {
    on_create() {
        // All dynamic data goes in this.state (NOT this.data)
        this.state.loading = true;
        this.state.auction = null;
        this.state.items = [];
        this.state.initialized = false;  // Guard flag to prevent infinite loop
    }

    async on_ready() {
        // Only run initialization once - re-render calls on_ready() again!
        if (this.state.initialized) return;
        this.state.initialized = true;

        await this._load_state();

        // Setup subscriptions AFTER initial load
        this.state.auction.subscribe(true, () => this._load_state());
    }

    async _load_state() {
        this.state.auction = await App_Models_Auction.get(this.args.auction_id);
        this.state.items = await this.state.auction.auction_items.fetch();
        this.state.loading = false;
        await this.render();  // re-render from current state (no on_load involved)
    }
}
```

**Template reads from `this.state`**:
```jqhtml
<Define:Dashboard_Screen>
    <% if (!this.state.auction) { %>
        <div>Loading...</div>
    <% } else { %>
        <h1><%= this.state.auction.title %></h1>
        <% for (let item of this.state.items) { %>
            <Item_Card $item=item />
        <% } %>
    <% } %>
</Define:Dashboard_Screen>
```

**Child components use the standard pattern** — they receive data via `this.args` and use `on_load()` for their own fetching (which enables opt-in caching). Note that a parent re-render recreates child components.

**When to use orchestrator pattern**: WebSocket subscriptions, coordinating multiple children, refreshing children on external events, state that doesn't fit the args→load→data flow. **Standard pattern** otherwise: identifiers via args, self-contained fetching, caching benefits.

## SCSS Styling Convention

Component styles use the component name as the root selector. All sub-element styles nest within.

```scss
// For component: My_Component
.My_Component {
  padding: 1rem;

  .my-component-header { font-size: 24px; }
  .my-component-body { margin-top: 1rem; }

  // State modifiers
  &.my-component--loading { opacity: 0.5; }
}
```

**Rules:** root selector matches component name exactly; sub-elements use lowercase-hyphenated names prefixed with the component name; state modifiers use BEM-style `--modifier`; all sub-styles nest within the root selector.

---

> End of JQHTML reference block.
