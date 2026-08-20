# JQHTML v2 — Agent & Developer Quickstart

**Public reference for JQHTML.** This file is a compiled subset of the internal development bible, intended to give developers (and their AI agents) a fast, accurate understanding of this repository.

Copyright (c) 2026 HansonXyz. MIT License.

---

## Answering Questions About JQHTML

**Always consult project documentation before answering questions about jqhtml syntax, features, or behavior.** JQHTML has its own syntax and conventions — do not give generic answers based on how other frameworks work.

When asked about jqhtml:
1. Search/read this file, `docs/reference/`, and relevant source files
2. Verify the answer against actual project documentation
3. Only then respond with the documented answer

---

## What JQHTML Is

JQHTML is a component templating system built on jQuery. It exists as a deliberate alternative to React and the modern JavaScript ecosystem's complexity and churn.

**Core premise:** Compose **logical concepts** in HTML (`<Dashboard_Header>`) rather than visual primitives (`<div class="d-flex justify-content-between">`). Structure before styling.

**Philosophy:** Like jQuery — simple, solid, an API that never changes. Templates compile at build time to plain JavaScript render functions. No virtual DOM, no state management layer, no runtime parsing.

**Historical note:** Based on JQHTML v1 (2014), completely rewritten as v2.

## Design Principles

1. **Semantic-First** — Name things what they ARE, not how they look:
   - `<User_Card>` not `<div class="card">`
   - `<Invoice_Status_Badge>` not `<span class="badge badge-success">`

2. **Incremental Scaffolding** — Undefined components work immediately (render as `<div>` with component name as class). Build structure first, define templates when needed.

   **Workflow:** Scaffold structure → add basic styles → define templates → add behavior → refine

3. **Components ARE jQuery** — `this.$` is genuine jQuery, not a wrapper. All jQuery methods work directly: `this.$.addClass()`, `this.$.fadeIn()`, `this.$.find()`, `this.$.on()`.

4. **No Backwards Compatibility** — Breaking changes are expected between versions. Old code is deleted when replaced; there are never two parallel systems for the same job.

5. **DOM IS the State** — No separate state container. jQuery solved this in 2006.

6. **Deterministic 5-Stage Lifecycle** — `create` → `render` → `on_render` → `load` → `ready`. No race conditions.

---

## Template Syntax

### Component Definition

**`<Define>` IS the HTML element** — it becomes the DOM node, doesn't wrap one:

```jqhtml
<Define:Button_Group class="btn-group" role="group">
  <%= content() %>
</Define:Button_Group>
```

**Renders as:**
```html
<div class="Button_Group Component btn-group" role="group">...</div>
```

Every component automatically gets TWO classes:
1. **Component Name** — `Button_Group` (automatic identifier)
2. **`Component`** — Framework marker (automatic)

You provide ONLY styling classes in the `class=""` attribute.

**Basic syntax:**
- `<Define:Component_Name>` — Component name (PascalCase required)
- `tag="div"` — Root element type (default: `div`)
- `class="..."` — Styling classes added to root
- Any HTML attributes — Passed through to element
- Filename should be snake_case (e.g., `user_card.jqhtml`)

**Element types:** Use the `tag=""` attribute:
```jqhtml
<Define:Button tag="button" class="btn btn-primary"><%= content() %></Define:Button>
```

### Define Tag Attributes

```jqhtml
<Define:Contacts_DataGrid
    extends="DataGrid_Abstract"
    $ajax_endpoint=Frontend_Contacts_Controller.datagrid_fetch
    $per_page=25
    class="card DataGrid">
```

- `extends=""` — Template inheritance (looks up parent by name at runtime)
- `$property=value` — Default args (quoted = string literal, unquoted = JS expression)
- Regular attributes — Applied to root element

**Template inheritance:** a parent template is looked up (via the `extends=""` attribute, then the JS class prototype chain) only when the child's template body is **slot-only** (contains nothing but `<Slot:>` tags at the top level). A body with any top-level HTML is used as-is. See "Slot-Based Template Inheritance" below.

### Interpolation

```jqhtml
<%= this.data.value %>              <!-- Escaped output (safe, default) -->
<%!= this.data.html %>              <!-- Unescaped HTML (pre-sanitized only) -->
<%br= this.data.text %>             <!-- Escaped + newlines to <br /> -->
<% let x = this.args.count; %>      <!-- JavaScript code -->
<%-- Comment --%>                   <!-- Template comment (not rendered) -->
```

**`<%br= %>`** — Escaped output with newline-to-BR conversion. Use for user-entered text that contains line breaks. HTML is escaped for security, but `\n` characters become `<br />`.

### Control Flow

```jqhtml
<% if (condition) { %>
  <div>Content</div>
<% } %>

<% for (let item of items) { %>
  <Item $data=item />
<% } %>
```

### Template Limitations

**Expressions cannot be attribute values inside HTML tags:**
```jqhtml
<!-- WRONG -->
<th <%= column.width ? `style="width: ${column.width};"` : '' %>>

<!-- CORRECT - Expression INSIDE attribute value -->
<th style="<%= column.width ? 'width: '+column.width+'px' : '' %>">
```
**Why:** The parser cannot distinguish `>` closing a tag from `>` inside JavaScript expressions.

**Void elements auto-close (HTML5 standard):** `<input type="text">`, `<img src="logo.png">`, `<br>`, `<hr>`, `<meta>`, `<link>` auto-close. Components still need explicit self-closing: `<User_Card />`

### $ Attributes (Component Parameters)

**CRITICAL: Quoted vs Unquoted behaves differently**

```jqhtml
<Component $sid="123" />              <!-- String "123" -->
<Component $sid=123 />                <!-- Number 123 -->
<Component $offset=-1 />              <!-- Negative number -->
<Component $user=this.data.user />    <!-- Object reference -->
<Component $handler=this.on_click />  <!-- Function reference -->
<Component $max=Model.get_max('name') />  <!-- Function call with string arg -->
```

Think of `$` attributes like function parameters.

**Unquoted value restrictions:**
- No spaces (parser terminates at first space)
- Negative numbers work: `$offset=-1`, `$value=-45.67`
- String args in function calls work: `$val=func('arg')` or `$val=func("arg")`
- A restricted grammar, not full JS: operators, ternaries, comparisons, and object/array literals throw a compile error — use a quoted `"<%= %>"` interpolation or compute the value in code instead

**Note:** `$` attributes are in-memory only (`this.args` / jQuery `.data()`) — they never appear as `data-*` attributes in the rendered DOM.

### @ Attributes (Event Binding)

Bind DOM events directly in templates:

```jqhtml
<Define:Button>
  <button @click=this.handle_click @mouseover=this.handle_hover>
    <%= content() %>
  </button>
</Define:Button>
```

**Common events:** `@click`, `@change`, `@submit`, `@focus`, `@blur`, `@keyup`, `@keydown`, `@mouseover`, `@mouseout`

### Scoped IDs ($sid)

Use the `$sid` attribute for component-scoped element IDs:

```jqhtml
<Define:User_Card>
  <h3 $sid="title"><%= this.data.name %></h3>
  <button $sid="edit_btn">Edit</button>
  <Child_Component $sid="child" />
</Define:User_Card>
```

**Renders as:**
```html
<!-- All scoped to User_Card's _cid (e.g., "abc123xyz") -->
<h3 id="title:abc123xyz" data-sid="title">...</h3>
<button id="edit_btn:abc123xyz" data-sid="edit_btn">Edit</button>
<div id="child:abc123xyz" data-sid="child" class="Child_Component" data-cid="def456uvw">...</div>
```

**Key behaviors:**
- Scoping uses the PARENT component's `_cid`
- Child components get scoped IDs using their parent's `_cid`, not their own `data-cid`
- `data-sid`/`data-cid` above are debug mirrors, absent in production (see Runtime Configuration) — the scoped `id` is what resolves
- Regular `id` attributes pass through unchanged
- When both `id` and `$sid` are present, `$sid` takes precedence

**Access in JavaScript:**
```javascript
this.$sid('title').text('John Doe');           // Finds #title:abc123xyz
this.$sid('edit_btn').on('click', () => this.edit());
const child = this.sid('child');                // Returns Child_Component instance
```

### $redrawable Attribute (Selective Re-rendering)

Make any HTML element redrawable without defining a separate named component:

```jqhtml
<Define:Dashboard>
  <div $redrawable $sid="counter" class="badge badge-primary">
    Count: <%= this.data.count %>
  </div>
</Define:Dashboard>
```

**Re-render syntax:**
```javascript
await this.reload();     // Re-fetches data via on_load(), updates this.data
this.render('counter');  // Only counter updates
```

**When to use:** Counters, badges, live data displays, form validation messages — any element that changes independently of its parent. Only the targeted element's DOM is updated.

---

## Component Lifecycle

**Components boot when they are created.** When a component is instantiated, `boot()` runs immediately and executes the full lifecycle:

```javascript
class My_Component extends Jqhtml_Component {
  on_create() {
    // Called BEFORE first render. MUST be synchronous.
    // Set up this.args and this.data initial state.
    this.args.filter = this.args.filter || 'all';
    this.data.items = [];
    // After on_create() completes, this.data is FROZEN until on_load()
  }

  on_render() {
    // Called IMMEDIATELY after DOM update, BEFORE children boot. Synchronous.
    this.$.css('opacity', '0');  // e.g. hide uninitialized UI
  }

  async on_load() {
    // this.data is UNFROZEN here — the only place to load API data.
    // Can ONLY access this.args (read) and this.data (read/write).
    // CANNOT access this.$, this.$sid(), or any other properties.
    this.data = await fetch(`/api/data?filter=${this.args.filter}`).then(r => r.json());
  }

  on_loaded() {
    // Called AFTER on_load() completes, on the REAL component.
    // this.data is FROZEN; this.$, this.state, this.args accessible.
    // Use to clone this.data into this.state for local manipulation.
    this.state.items = [...this.data.items];
  }

  async on_ready() {
    // All children guaranteed ready. Safe for DOM manipulation and event handlers.
    this.$sid('button').on('click', () => this.handle_click());
  }

  on_stop() {
    // Cleanup: timers, intervals, listeners. Synchronous.
    clearInterval(this.state.update_interval);
  }

  on_viewport_resize(viewport_width) {
    // window.innerWidth, delivered after every on_render(), after every
    // on_ready(), and on window resize (debounced 30ms). Synchronous.
    // Never bind $(window).on('resize') yourself.
    this.$.toggleClass('is_narrow', viewport_width < 768);
  }
}
```

### Full Lifecycle Order

1. `create()` → calls `on_create()` BEFORE first render
2. `.trigger('create')`
3. `_render()` — creates DOM, instantiates and boots child components
4. `on_render()` — after DOM update, BEFORE children boot (synchronous)
5. `.trigger('render')`
6. `load()` → calls `on_load()` (async)
7. `on_loaded()` — after data applied; `this.data` frozen, `this.$`/`this.state` accessible
8. `.trigger('loaded')`
9. [If `this.data` changed] — re-run `_render` → `on_render` → `trigger('render')`
10. [Wait for all children ready] — bottom-up: children complete before parent
11. `ready()` → calls `on_ready()` (async)
12. `.trigger('ready')`

**Key behaviors:** children boot in parallel; ready is bottom-up; components boot immediately on creation; no queues or batching.

### this.data Freeze/Unfreeze Cycle

1. **on_create()**: writable — set initial defaults here
2. **After on_create()**: **FROZEN** — modifying throws
3. **Before on_load()**: **RESTORED** to the on_create() snapshot (on subsequent loads)
4. **During on_load()**: **UNFROZEN** — the only place to load API data
5. **After on_load()**: **FROZEN** again; all other lifecycle methods see read-only data

### on_load() Access Restrictions

`on_load()` runs against a Proxy that blocks access to most component properties.

**Allowed:** `this.args` (read-only), `this.data` (read/write).
**Blocked (throws):** `this.$`, `this.$sid()`, `this.sid()`, `this.render()`, `this.component_name()`, everything else.

**Why:** `on_load()` is for data fetching only.

### Double-Render Pattern

Components may render TWICE if `on_load()` modifies `this.data`:

1. First render with `on_create()` data (loading state)
2. `on_load()` populates `this.data`
3. Automatic re-render with populated data
4. `on_ready()` fires after the final render

```jqhtml
<Define:Product_List>
  <% if (!this.data.loaded) { %>
    <Loading_Spinner />
  <% } else { %>
    <% for (let product of this.data.products) { %>
      <Product_Card $product_id=product.id />
    <% } %>
  <% } %>
</Define:Product_List>
```

Never manually call `this.render()` inside `on_load()` — the framework watches `this.data` and re-renders automatically.

---

## State Management

### this.args — Component Configuration
Input parameters (from `$` attributes). Mutable everywhere except `on_load()` (read-only there). Change args → call `this.reload()`. Used as the cache key.

### this.data — Loaded Data from APIs
Set defaults in `on_create()`, populate in `on_load()`. Freeze/unfreeze cycle as above. Modifications trigger automatic re-renders. Cached by component name + `this.args`.

### this.state — Component-Local State
No framework meaning — a convention for component-specific values (timers, flags, WebSocket connections). Mutable anywhere, never frozen, never cached, no automatic re-renders.

### State Decision Tree

| Question | Use |
|----------|-----|
| Does it come from an API? | `this.data` |
| Does it configure what data to fetch? | `this.args` |
| Is it passed from a parent component? | `this.args` |
| Is it UI state (hover, focus, timers)? | `this.state` |
| Should changing it re-fetch data? | `this.args` + `reload()` |
| Should changing it re-render? | `this.data` (in on_load only) |

---

## Component API

### Core Properties

```javascript
this.args         // Component parameters (from $ attributes)
this.data         // Loaded data (from on_load)
this.state        // Component-local state (convention)
this.$            // jQuery element reference (root element)
this._cid         // Component instance ID (unique, used for $sid scoping)
this.$sid('name') // Find element by scoped ID (returns jQuery object)
this.sid('name')  // Get child component instance by scoped ID
```

### Lifecycle Manipulation Methods

| Method | Calls on_load() | Calls on_ready() | Redraws DOM | Checks Cache | Use Case |
|--------|-----------------|------------------|-------------|--------------|----------|
| `load()` | Yes | No | No | No | Re-fetch data only; developer controls next step. Returns `true` if data changed |
| `render(sid?)` | No | Yes | Always | No | Re-render with current data (pass a `$sid` to re-render one `$redrawable`) |
| `reload()` | Yes | Yes | Conditional | If args changed | Re-fetch and re-render — the standard update method. Debounced |
| `refresh()` | Yes | Conditional | Only if data changed | If args changed | Polling / background sync without flicker. Debounced (shares queue with reload) |
| `ready(cb?)` | No | No | No | No | Promise (or callback) resolving when component completes its lifecycle |
| `stop()` | No | No | No | No | Stop lifecycle before removal; calls `on_stop()`, does NOT remove DOM |

`redraw()` is an alias for `render()`.

**Synchronous requirements:** `on_create()`, `on_render()`, `on_stop()`, `on_viewport_resize()`, `stop()` MUST be sync. `on_load()`, `on_loaded()`, `on_ready()` CAN be async.

**`on_viewport_resize(viewport_width)`** - Not a lifecycle stage; a notification. Fires after every `on_render()`, after every `on_ready()`, and on window resize (debounced 30ms) for every component in the document. The argument is `window.innerWidth` in CSS pixels - it agrees with CSS media queries; for the component's own width use `this.$.width()`. Detached and stopped components are skipped, and a handler that throws is logged without stopping the fan-out. Prefer CSS media/container queries; use this only when layout needs real measurement (canvas sizing, chart redraw, virtual scroll windowing, text truncation).

**Invocation/hook pattern:** you call the unprefixed method (`render()`, `load()`); the framework runs your `on_` hook (`on_render()`, `on_load()`).

### Creating Components Programmatically

```javascript
// Setter mode - returns jQuery object for chaining
$('#container').component('User_Card', {user_id: 123});
$('<div>').component('Dashboard', {}).appendTo('body');

// Getter mode - returns component instance (no arguments)
const component = $('#my-component').component();
component.reload();
await component.ready();
```

### Lifecycle Event Callbacks

```javascript
$('#my-component').component().on('ready', (component) => { ... });
$('#my-component').component().once('loaded', (component) => { ... });
```

**Supported events:** `render`, `rendered`, `create`, `load`, `loaded`, `ready`, `stop`. Events are sticky — if the event already occurred, the callback fires immediately. `.once()` fires exactly once. `component.rendered(cb?)` mirrors `ready()` but resolves when the synchronous render chain completes, before the ready phase.

---

## Advanced Features

### content() — Inner Content

```jqhtml
<Define:Panel>
  <div class="panel">
    <div class="panel-header"><%= this.args.title %></div>
    <div class="panel-body"><%= content() %></div>
  </div>
</Define:Panel>
```

```blade
<Panel $title="User Information">
  <p>User details go here</p>
</Panel>
```

### Named Slots

```jqhtml
<Define:Card_Layout>
  <div class="card">
    <div class="card-header"><%= content('header') %></div>
    <div class="card-body"><%= content('body') %></div>
  </div>
</Define:Card_Layout>
```

```blade
<Card_Layout>
  <Slot:header><h3>User Profile</h3></Slot:header>
  <Slot:body><p>Name: <%= this.data.name %></p></Slot:body>
</Card_Layout>
```

**Passing data to slots:** `content('row', record)` in the parent template; the slot body receives the value as a variable named after the slot (`row`). Slot names cannot be JavaScript reserved words.

**All-or-nothing rule:** once an invocation uses any `<Slot:name>`, put ALL content in slots — mixing slotted and unslotted content is unsupported.

### Slot-Based Template Inheritance

When a component template contains ONLY slots at the top level (no HTML), it automatically inherits the parent class template. The framework walks the JS prototype chain to find parent templates.

**Three inheritance mechanisms that work together:**
1. **JS class inheritance** (behavior): `class Child extends Parent {}`
2. **Template `extends=""` attribute** (structure): `<Define:Child extends="Parent">` — takes effect when the child's template body is slot-only
3. **Slot-based** (automatic): template with only slots inherits from the JS parent

Note: `tag` is NOT inherited through `extends` — each `<Define:>` sets its own `tag` or defaults to `div`.

### Parent-Child Communication

Pass callbacks as component parameters:

```jqhtml
<Product_Card $product=product $on_delete=this.handle_delete />
```

The child calls `this.args.on_delete(id)`; the parent handler reloads or re-renders as needed.

### gate_load() — Delay First Data Load

Register promises in `on_create()` that must settle before the component's FIRST `on_load()` runs — the initial render still paints immediately:

```javascript
on_create() {
  this.gate_load(window.auth_ready);  // on_load() waits for auth
}
```

One-shot: gates apply only to the first load; `reload()`/`refresh()`/`stop()` release them. Useful for auth-gated fetching and SSR hydration.

### shallowFind() — Scoped jQuery Search

`this.$.shallowFind(selector)` — framework-added jQuery method that searches downward but stops descending at the first match on each branch (unlike `.find()`, which recurses fully). Useful for finding direct child regions without reaching into nested components.

### Runtime Configuration

Integration-level settings the host app supplies at load. Distinct from `jqhtml.debug`
(a developer's interactive tracing switch) — this describes the ENVIRONMENT the app runs in.

```javascript
jqhtml.init($, { mode: 'production' });   // or jqhtml.configure({ mode: 'production' })
jqhtml.get_config();                       // read resolved settings
```

`mode` is `'development'` (default) or `'production'`, and sets defaults for every flag;
an explicit flag in the same call overrides that default. Passing nothing keeps current
behavior — production is always opt-in.

| Flag | dev | prod | Effect |
|------|-----|------|--------|
| `warn_uncacheable_args` | on | off | Warns when a component with a custom `on_load()` gets a non-serializable arg AND defines no `cache_id()` — it still works but silently loses cache reuse and load deduplication |
| `debug_attributes` | on | off | Emits `data-sid` and `data-cid` — debug mirrors of the scoped `id="<sid>:<cid>"` and of `_cid` |

Both are inspection-only: `$sid()` resolves through the scoped `id` and scoping uses the
`_cid` property, so suppressing them changes nothing functional. **Do not write selectors
against either.** The *transient* `data-cid` the instruction processor uses to correlate
freshly-injected HTML with component data is a separate, functional thing — written and
removed during rendering, and never suppressed.

Configure before components boot; `debug_attributes` is read during rendering.

**Full documentation:** `/docs/reference/20_runtime_configuration.md`

### Caching (Stale-While-Revalidate)

**Cache keys from plain data.** A component's cache key is its name plus its args. Primitives
and plain data (objects/arrays of primitives, nested freely) are keyed by deterministic
CONTENT, so `$params={parent_id: 12}` rebuilt on every render still hits the same entry.
Functions, class instances, DOM/jQuery objects, circular structures and values over 500 bytes
DECLINE instead — the element is marked `data-nocache="<arg>:<reason>"` and dev mode warns.
Declining is deliberate: a serializer that dropped a callback would let two different args
share a key and serve the wrong cached content.

**Deduplication is stricter than caching** and does NOT use content keys — it needs primitive
args or an author-supplied id. A deduplicated follower skips `on_load()` entirely with no
revalidation, so a wrong key there is permanently wrong data; redundant requests are the
cheaper failure.

Opt-in localStorage caching. Enable with `jqhtml.set_cache_key('myapp_v1.2.3_user_456')` — the key should include app build hash + user ID (cache auto-clears when it changes). Behavior: cache hit → instant render → `on_load()` revalidates in background → re-render if changed.

A second parameter selects the mode: `set_cache_key(key, 'data' | 'html')`. Default `'data'` caches `this.data`; `'html'` caches the rendered HTML snapshot and can skip template execution entirely on cache hit.

Components can override the cache key via a `cache_id()` method when `this.args` doesn't capture what matters.

**Full documentation:** `docs/reference/15_deduplication_and_caching.md`

### Server Integration (jqhtml.boot)

Hydrate server-rendered placeholders into live components. The server outputs `<div class="_Component_Init" data-component-init-name="Component_Name" data-component-args='{"key":"value"}'>`, then the client calls `await jqhtml.boot()`.

**SSR Preload APIs** on `window.jqhtml`: `start_data_capture()`, `get_captured_data()`, `stop_data_capture()`, `set_preload_data(entries)`, `clear_preload_data()`. See `packages/ssr/README.md`.

**Full documentation:** `docs/reference/18_boot.md`

---

## Component Registration & Loading

**.jqhtml and .js files work together:**

1. **Compile .jqhtml** → JavaScript template definition (`__jqhtml_template: true`)
2. **Register template:**
   ```javascript
   import User_Card_Template from './user_card.jqhtml';
   jqhtml.register(User_Card_Template);
   ```
3. **Register class (if the component has behavior):**
   ```javascript
   class User_Card extends Jqhtml_Component { }
   jqhtml.register(User_Card);  // Uses class name
   ```
4. The framework merges template and class by component name.

**Registration methods:**
- `jqhtml.register(source)` — unified router, auto-detects template or class
- `jqhtml.register_template(template)` — explicit template registration
- `jqhtml.register_component(name, class)` — explicit class registration with name

**If your build minifies class names**, define `static component_name = 'User_Card';` so the name survives minification.

**No JS file is needed** for template-only components (they use the default `Jqhtml_Component` class).

---

## Repository Structure

```
packages/
├── core/             # Runtime (lifecycle, component system, jQuery integration)
├── parser/           # Compiler: .jqhtml → JS (lexer, parser, codegen, sourcemaps)
├── ssr/              # Server-side rendering for SEO / hydration
└── vscode-extension/ # Syntax highlighting + language support for .jqhtml files
```

- **`packages/core`** — key files: `src/component.ts` (base class), `src/lifecycle-manager.ts` (5-stage orchestration), `src/index.ts` (entry)
- **`packages/parser`** — key files: `src/lexer.ts`, `src/parser.ts`, `src/codegen.ts`; ships the `jqhtml-compile` CLI
- **`docs/reference/`** — detailed feature documentation (source of truth)
- **`tests/`** — behavioral test suites

### Template Compilation

`.jqhtml` templates compile to imperative JavaScript render functions returning an instruction array (`{tag: [...]}` objects and strings) that the runtime processes into DOM. **Not JSX** — no React-style transformation. Sourcemaps map errors back to original `.jqhtml` line numbers.

```bash
npx jqhtml-compile my_component.jqhtml   # (from @jqhtml/parser)
```

---

## Building & Testing

```bash
npm install                     # Install dependencies
npm run build                   # Build parser + core (./build.sh)
cd tests && ./run-all-tests.sh  # Full behavioral suite (78 scenarios × 3 cache modes)
```

Individual packages: `npm run build:core`, `npm run build:parser`, `npm run test:parser`, `npm run test:core`. The ssr and vscode-extension packages build/run independently.

### Debug System

```javascript
jqhtml.debug.verbose = true;                        // Cache/dedup/SSR logging
jqhtml.setDebugSettings({ logFullLifecycle: true }) // Per-lifecycle-phase tracing
```

---

## Naming Conventions

- **Components:** `Pascal_Snake_Case` in source (`User_Profile_Card`); public docs may show community-standard `PascalCase` (`UserProfileCard`) — both refer to the same thing
- **Files:** `snake_case` (`user_card.jqhtml`, `user_card.js`)
- **Variables:** `snake_case`

**Component names follow `Noun_Context`:** ✅ `User_Profile_Card`, `Invoice_Status_Badge` — ❌ `BlueCard` (visual), `Container2` (meaningless), `Wrapper` (generic).

### Component Documentation Standard

Document `.jqhtml` files with template comments (stripped by the compiler):

```jqhtml
<%--
User_Card - Display user profile with avatar and status

ARGS:
    $user_id="123"  - User ID to fetch

DATA:
    this.data = {name, email, status, avatar_url}
--%>
```

---

## Versioning

JQHTML v2 stays v2 forever. Version format: `2.MONTHS_SINCE_AUG_2025.BUILD_COUNT` (e.g., v2.3.17 = 3 months after Aug 2025, 17th build that month). Breaking changes may occur in any release.

---

## Quick Reference

### Common Mistakes

| Wrong | Right |
|-------|-------|
| `<Define:Button><div class="btn">` | `<Define:Button class="btn">` |
| `<Define:Button class="Button btn">` | `<Define:Button class="btn">` |
| `<Define:Button><button>` | `<Define:Button tag="button">` |
| `this.state = x` in on_load | `this.data.x = value` |
| Manual `this.render()` in on_load | Let framework auto-render |

### Lifecycle Access Rules

| Method | this.args | this.data | this.$ | Other |
|--------|-----------|-----------|--------|-------|
| on_create | read/write | read/write | no | no |
| on_render | read | read | yes | yes |
| on_load | read | read/write | **NO** | **NO** |
| on_loaded | read | read | yes | yes |
| on_ready | read | read | yes | yes |

---

## Protected Code — Do Not Remove

`jqhtml.tombstone` (in `packages/core/src/index.ts`, value `'pepperoni and cheese'`) is a permanent easter egg referencing a 90s Oregon Trail / Tombstone Pizza meme. **The build fails if it is missing from compiled output.** Never remove it.

---

**JQHTML v2:** Component system for mechanical thinkers who compose logical concepts instead of wrestling cryptic class names. Built on jQuery. No virtual DOM. No state management. No backwards compatibility. Clean, honest, and deterministic.
