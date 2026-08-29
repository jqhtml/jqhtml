# JQHTML — LLM Reference

> Drop-in context for AI-assisted development with JQHTML. Paste this file into a
> project's agent instructions when the project uses JQHTML.

JQHTML is a component templating system built on jQuery. Components ARE jQuery objects
with a deterministic lifecycle. The DOM is the state — no virtual DOM, no state
abstraction, no reconciler. You update elements directly through jQuery.

Packages: `@jqhtml/core` (runtime), `@jqhtml/parser` (compiler, ships the
`jqhtml-compile` CLI), `@jqhtml/ssr` (server rendering), plus a VS Code extension.
Repo: github.com/jqhtml/jqhtml.

---

## Anatomy of a component

A component is up to three co-located files sharing one name:

```
user_card.jqhtml     # markup - the template
user_card.js         # logic, lifecycle, state (optional - only when behavior exists)
user_card.scss       # the component's COMPLETE look, wrapped in .UserCard
```

The stylesheet is shown as SCSS because nesting makes the convention read cleanly, but
nothing about it is SCSS-specific - see [Styling](#styling).

Either may be omitted:

- **Template only** — markup with no behavior; uses the default `Jqhtml_Component` class.
- **Class only** — behavior with no template; the default template renders `content()`.
- **Neither** — an undefined component still renders, as a `<div>` carrying the component
  name as a class. A page can therefore be scaffolded out of names before a single one
  exists, and nothing breaks in the meantime.

Component names must start with a capital letter, and the JS class name must match the
template name exactly. **A tag is a component only if its first letter is uppercase** —
`<user_card>` is never a component no matter what is registered; it renders as a literal
unknown HTML element with no scoping, lifecycle or `Component` class.

Naming: these docs use `PascalCase` (`UserCard`). Some projects use `Pascal_Snake_Case`
(`User_Card`); both work, so follow whichever convention the project you are in already
uses.

## Compiling and registering

Templates compile at build time — there is no runtime template parsing.

```bash
npx jqhtml-compile user_card.jqhtml --format esm   # iife|esm|cjs|umd (default: iife)
```

Bundler users: `@jqhtml/vite-plugin` and `@jqhtml/esbuild-plugin` compile `.jqhtml`
imports automatically.

- `iife` — self-executing, registers with `window.jqhtml` automatically.
- `esm` / `cjs` / `umd` — module export; you register it yourself:

```javascript
import User_Card_Template from './user_card.jqhtml.js';
jqhtml.register(User_Card_Template);   // unified: auto-detects template or class

class UserCard extends Jqhtml_Component { }
jqhtml.register(UserCard);             // registers under the class name
```

Explicit forms: `jqhtml.register_template(template)` and
`jqhtml.register_component(name, klass)`. The framework merges template and class by
component name. **If your build minifies class names**, define
`static component_name = 'UserCard';` so the name survives minification.

Some frameworks that embed JQHTML discover and register components automatically. If
yours does, follow its convention instead of calling `register()` by hand.

---

## Template syntax

### `<Define>` IS the element

`<Define>` is not a wrapper around your markup — it BECOMES the rendered element.

```jqhtml
<Define:SaveButton tag="button" class="btn btn-primary">
    Save
</Define:SaveButton>
```

renders as:

```html
<button class="SaveButton Component btn btn-primary">Save</button>
```

The component's own class name is always stamped on the root, which is what makes CSS
scoping automatic (`.SaveButton { ... }`). Every ancestor's name is stamped too
(`UsersDataGrid DataGridAbstract Component`), so an abstract base's stylesheet styles its
own class and every concrete descendant inherits that look for free.

Use `tag=""` to choose the rendered element; the default is `div`. Do not wrap a
`<Define>` in another div to get the element you wanted.

### Interpolation

| Form | Meaning |
|---|---|
| `<%= value %>` | Escaped output (the default; use this) |
| `<%!= html %>` | Unescaped/raw HTML — only for values you trust or have sanitized |
| `<%br= text %>` | Escaped, with newlines converted to `<br />` |
| `<% javascript %>` | A JavaScript block — no output |
| `<%-- comment --%>` | A JQHTML comment, removed at compile |

**Use `<%-- --%>` for comments, always — never `<!-- -->`.** An HTML comment is still
parsed for JQHTML constructs, so JS inside it still executes, and it ships to the DOM.
Inside a `<% %>` block, a line-leading `//` is stripped as an ordinary JS comment.

### Attributes

| Form | Meaning |
|---|---|
| `$quoted="string"` | String literal arg |
| `$unquoted=expression` | JavaScript expression arg — ends at the first space unless bracketed |
| `$sid="name"` | Scoped element id, addressable as `this.$sid('name')` |
| `attr="<%= expr %>"` | An ordinary HTML attribute with interpolation |
| `$prop=value` ON `<Define>` | A DEFAULT for `this.args.prop`; the caller's `$prop=` wins |
| `tag="article"` at an INVOCATION | Overrides the rendered element for that one instance |

Key restrictions:

- **`<Define>` attributes are static.** No `<%= %>` on the `<Define>` tag itself. For a
  dynamic attribute on the root element, use inline JS:
  `<% this.$.attr('data-id', this.args.id); %>`.
- **`$prefix` means component arg, NOT HTML attribute.** `<MyComponent $data-id=123 />`
  creates `this.args['data-id']`; it does not put a `data-id` attribute on the DOM node.
- **An unquoted `$` expression ends at the first space unless it is bracketed.**
  `$alert=_x > 0` fails; `$alert=(_x>0)` and `$alert=(_x > 0)` both work, because the
  parser tracks the parentheses. Wrap anything containing spaces, or precompute it.
- **Unquoted `$` expressions are synchronous.** The generated render function is not
  async — no `await`. Precompute in a `<% %>` block.
- **Conditional attributes use if-statements, not ternaries**, and toggle a WHOLE
  attribute *between* attributes: `<input <% if (this.args.required) { %>required<% } %> />`.
- **`class` and `style` MERGE; everything else overrides.** Define and invocation classes
  union (no duplicates); `style` merges per CSS property with the invocation winning
  conflicts. Plain attributes and `$` args are replaced outright by the invocation.
- **Void HTML elements auto-close** (`<input>`, `<img>`, `<br>`, `<hr>`); components never
  do — always `<Card />` or `<Card>...</Card>`.

### Two syntax gotchas

**Never put `<% %>` inside a quoted attribute value.** This is a compile error
(`<% %> code blocks are not allowed inside attribute values`), so it fails loudly:

```jqhtml
<!-- wrong - compile error -->
<div class="base<% if (x) { %> extra<% } %>">

<!-- right - compute the value, then interpolate the whole thing -->
<% const cls = 'base' + (x ? ' extra' : ''); %>
<div class="<%= cls %>">
```

A value that *starts* with `<%=` is fine (`class="<%= cls %>"`); a `<%` appearing
mid-string inside the quotes is not.

**`<pre>` and `<textarea>` are raw-content elements.** Both interpolate normally:

```jqhtml
<textarea><%= this.data.notes %></textarea>
<pre><code class="language-<%= lang %>"><%= this.data.src %></code></pre>
```

`<pre>` is lexed as a raw-text element, so nested markup is preserved and its interior
whitespace survives byte for byte — `<pre><code>` is the standard code-block idiom and
compiles. `<textarea>` takes text only: a nested element inside one is a compile error,
matching its HTML content model. Neither accepts a `<% %>` code block, because their
content is one flat string with nowhere for statements to write output — build the value
first and interpolate it.

### Inline logic and handlers

```jqhtml
<Define:ToggleRow>
  <% this.toggle = () => { this.state.open = !this.state.open; this.render(); }; %>
  <button @click=this.toggle>Toggle</button>
</Define:ToggleRow>
```

- `@click=this.method` is **unquoted**. A quoted value is a compile error, because a
  string cannot be a function reference.
- The handler receives **`(event, element)`** — the DOM event and the bound element, with
  `this` bound to the component. `preventDefault()` is NOT automatic; call it yourself for
  `@submit` and link clicks.
- **Placement**: `@click` works on child elements inside the template. It does NOT work on
  `<Define>` itself, because Define attributes are component args, not DOM attributes. To
  bind the root: `<% this.$.click(() => { ... }); %>`.

Common events: `@click`, `@change`, `@submit`, `@focus`, `@blur`, `@keyup`, `@keydown`,
`@mouseover`, `@mouseout`.

### Fail loud in the template

```jqhtml
<% if (!this.args.record_id) throw new Error('record_id required'); %>
```

A missing required arg should break the render visibly, not paint an empty component.

### When to write JS in the template

When behavior is a few lines, write it in the template and skip the `.js` file entirely.
Move to a class once the JS overwhelms the template, needs external data, or holds
multiple methods and real state.

---

## Content and slots

```jqhtml
<Define:Card tag="div" class="card">
    <%= content() %>
</Define:Card>

<Card><p>Hello</p></Card>
```

`content()` renders whatever the caller placed between the opening and closing tags — the
default, unnamed slot. **A wrapper component that forgets `content()` silently discards
its caller's content.**

**`content()` returns an array, not text.** When the caller supplied content it returns
the caller's markup as compiled output instructions, and the template spreads that into
its own output when you write `<%= content() %>` (the only sanctioned way to emit it).
When the caller supplied nothing it returns `''`. So the value may be assigned to a
`const`, emitted later, and tested for presence (`if (footer_actions)`) to decide whether
a wrapper should draw at all. What it never is, is a string carrying content: `.trim()`,
`=== ''` on the populated case, concatenation, or your own escaping all operate on an
array and throw at render. A component that needs a caller-supplied VALUE takes an
argument (`$label`); caller MARKUP is `content()`.

Named slots are a separate channel for components with more than one content region:

```jqhtml
<Define:DatagridCard>
    <div class="card">
        <div class="card-header"><%= content('toolbar') %></div>
        <div class="card-body"><%= content('body') %></div>
    </div>
</Define:DatagridCard>

<DatagridCard>
    <Slot:toolbar><button>Add</button></Slot:toolbar>
    <Slot:body><MyDatagrid /></Slot:body>
</DatagridCard>
```

**Once a template uses ANY named slot, ALL caller content must be in slots** — mixed
content is a compile error.

---

## Template inheritance

Three mechanisms that compose; use as many as the component needs.

| Mechanism | Declares | Use for |
|---|---|---|
| `<Define:Child extends="Parent">` | Template structure | The child supplies `<Slot:x>` blocks; the parent's markup and its `content('x')` calls do the rendering |
| `class Child extends Parent` (JS) | Behavior | Inherit lifecycle hooks and methods; override only what differs |
| Slot-only template (no `extends=`) | Template structure, implicitly | A child whose body is ONLY `<Slot:>` blocks auto-inherits the JS parent class's template |

**Resolution order**: explicit template (markup present) → `extends=""` → the JS class
prototype chain. `extends=""` is consulted only when the child body is slot-only; a child
template containing real markup renders its own markup and ignores it.

If both the JS class and the template name a parent, they must name the SAME parent.
Nothing validates this — each chain resolves independently and a divergence is silently
wrong.

### Slot data

`content('name', value)` passes a value INTO the slot. The `<Slot:name>` block receives it
as an in-scope variable **named after the slot** — no parameter is declared.

```jqhtml
<%-- the base owns the structure --%>
<Define:DataGridAbstract tag="table" class="table">
  <thead><tr><%= content('header') %></tr></thead>
  <tbody>
    <% for (let record of this.data.records) { %>
      <tr><%= content('row', record) %></tr>
    <% } %>
  </tbody>
</Define:DataGridAbstract>

<%-- the concrete supplies only slots --%>
<Define:UsersDataGrid extends="DataGridAbstract" tag="table" class="table">
  <Slot:header><th>ID</th><th>Name</th></Slot:header>
  <Slot:row><td><%= row.id %></td><td><%= row.name %></td></Slot:row>
</Define:UsersDataGrid>
```

This is the only way to build a per-record slot, and therefore the only way to build a
datagrid.

### What is and is not inherited

| Attribute | Through `extends=` / the class chain |
|---|---|
| `tag=""` | **NEVER inherited** |
| `class` | Merged — parent and child classes both apply |
| everything else | Child overrides parent |

**`tag=""` is never inherited.** Every `<Define:>` in a chain must repeat its own `tag=""`
or it silently falls back to `div`. A concrete component extending an input abstract that
omits `tag="input"` renders a `<div>`: no error, wrong DOM, and both the styling and any
`.val()` behavior break downstream. This is the most common silent failure when building
on an abstract base.

**Slot-only inheritance re-scopes `$sid`.** A child defined by slot-only inheritance
re-scopes the content passed into it, so the PARENT's `this.sid('x')` on elements inside
that content returns null. Use body-preserving `extends=` on the `<Define:>` tag instead.

---

## Lifecycle

### The six stages

1. **`on_create()`** — set defaults (sync): `this.data.rows = []; this.data.loading = true;`
2. **render** — the template executes (top-down: parent before children)
3. **`on_render()`** — fires after render, BEFORE children are ready (top-down, sync)
4. **`on_load()`** — fetch data into `this.data` (bottom-up, parallel siblings, async)
5. **`on_loaded()`** — runs on the real component, not the detached proxy
6. **`on_ready()`** — all children guaranteed ready (bottom-up, async)

Plus **`on_stop()`** — teardown when the component is destroyed (sync).

**The full sequence, spelled out**: `on_create` (no DOM, sync) → render + `on_render`
(sync — with no loaded data, or with cached data on a cache hit) → `on_load` (async, runs
to completion) → if the loaded data differs from what rendered, render + `on_render` again
(sync) → wait for every child component to reach its own ready state → `on_ready`.

**Double-render**: if `on_load()` modifies `this.data`, the component renders twice
(defaults → populated). `on_ready()` fires once, after the final render.

**`on_ready` means FULLY LOADED AND READY** — a loading indicator there is a contradiction
in terms. Anything that must exist *while* loading (an overlay, a spinner, a disabled
state) is wired in `on_render()` and driven by STATE, because renders rebuild the DOM and
an imperatively-drawn indicator dies on the post-load re-render. The shape: a flag set in
`on_create()` and cleared when data lands, with `on_render()` drawing or removing the
indicator to match.

**Synchronous requirements**: `on_create()`, `on_render()`, `on_stop()` and
`on_viewport_resize()` MUST be synchronous. `on_load()`, `on_loaded()` and `on_ready()`
may be async.

### `on_render` — the full contract

**May fire more than once**: a cached-stub render, the post-`on_load()` re-render, and
every `render()` / `redraw()` / `reload()`. Because it re-fires, **any DOM handler bind
MUST be idempotent**:

```javascript
on_render() {
    this.$sid('row').off('click.mycmp').on('click.mycmp', () => this._open());
}
```

**Own-template only by default**: read, format and bind handlers to raw HTML nodes owned
directly by this component. The `create → render → on_render` chain is synchronous and
recurses through the whole subtree until it hits a component with an async `on_load()`, so
a parent CAN touch a first-generation child in its own `on_render()` — but only if that
child's API is deliberately timing-indifferent (safe before AND after the child loads). A
child with no such contract must wait for `on_ready()`.

**Cached-component caveat**: a child's cache-hit state is not exposed by any API or event,
so never assume `on_render` sees final data. The child may have painted nothing yet, or
painted a stale-while-revalidate cache stub that `on_load()` will still reconcile. If your
logic needs finalized `this.data`, it belongs in `on_ready()`.

### The hook decision matrix

Most component bugs are code in the wrong hook.

| I want to... | Hook | Why |
|---|---|---|
| Set `this.data`/`this.state` defaults | `on_create` | Before first render |
| Register a persistent component-level handler (`this.on`/`once`) | `on_create` | Persists across renders; `on_ready()` risks infinite loops from event replay |
| Fetch data | `on_load` | Only place `this.data` is writable post-create; NO DOM or child access |
| Format the component's OWN just-rendered markup | `on_render` | Fires immediately after draw, even on a cached-stub render; must be idempotent |
| Bind a handler to a static direct-descendant element | `on_render` (dedup guard) or `on_ready` | Child DOM recreated each render, must re-attach |
| Interact with a child component (methods, state, its events) | `on_ready` | Children guaranteed ready only here |
| Read the finalized `this.data` for post-draw logic | `on_ready` | `on_render` may see a stale cached stub or default data |
| Start a socket/subscription/observer | `on_ready` | One-time, needs a stable tree |
| Teardown (sockets, observers, timers) | `on_stop` | Symmetric with `on_ready` setup |

### Two hooks the six stages do not cover

**`gate_load(promise)`** — called in `on_create()` (repeatable; all gates awaited
together), it holds this component's FIRST `on_load()` until the gates settle. First paint
still happens immediately: a gate delays data, never render. Gates are one-shot —
`reload()`/`refresh()` never re-await them, and either one called while gated releases the
wait. A rejected gate is logged and the load proceeds.

**`on_viewport_resize(viewport_width)`** — not a stage, a notification. Fires (sync) after
every `on_render()`, after every `on_ready()`, and on window resize debounced 30ms; the
argument is `window.innerWidth`. **Never bind `$(window).on('resize')` yourself** — the
framework owns one listener for the whole page and there is nothing to unbind. Prefer CSS
media/container queries; override only when layout needs real measurement (canvas sizing,
chart redraw, virtual scrolling).

---

## State: the three buckets

**`on_load()` runs on a DETACHED PROXY and may only touch `this.args` and `this.data`** —
calling any method or reaching the DOM from it throws
(`[JQHTML] Cannot access ... during on_load()`). Imperative post-load work belongs in
`on_loaded()` (the real component) or `on_ready()`; render-coupled work belongs in
`on_render()` driven by state.

- **`this.args`** — component arguments. Read-only in `on_load()`, modifiable everywhere else.
- **`this.data`** — the MAYBE-CACHED result of `on_load()`. Writable ONLY in `on_create()`
  and `on_load()`; frozen everywhere else, and the framework THROWS on any other write.
- **`this.state`** — developer-owned scratch, initialized `{}`. No framework semantics, no
  caching, writable anywhere EXCEPT inside `on_load()`.

```javascript
async on_load() {
    this.data = await fetch_users(this.args.filter);   // allowed: read args, write data

    this.$sid('element').text();   // throws - no DOM
    this.state.count = 5;          // throws - no state
    this.args.filter = 'new';      // throws - args are read-only here
}
```

### What `this.data` actually IS — and when not to use it

`this.data` is not "the component's data"; it is specifically the cacheable output of the
load cycle. On a repeat invocation the framework may serve a CACHED copy and render before
`on_load()` revalidates — that is the feature. Two consequences:

1. Anything in `this.data` may come back STALE on a later visit, describing the previous
   life of the component. A flag like `record_loading: false` cached from a finished visit
   LIES during the next visit's in-flight revalidation.
2. Anything that is not genuinely a load result — form seed values, in-progress
   selections, UI mode flags — does not belong there. Use `this.state`: it is born fresh
   per instance, carries no caching semantics, and the framework never touches it.

**Decision rule**: *did `on_load()` fetch this, and is a stale cached copy acceptable until
revalidation?* → `this.data`. Everything else → `this.state` (cross-render) or a plain
instance property (per-instance, e.g. a loading flag that must never be cached).

Quick guide:

- Loading from an API? → `this.data` in `on_load()`
- Need a reload with different params? → modify `this.args`, call `reload()` (preferred)
- Reload would cost unnecessary requests or lose user input? → track it in `this.state`
- UI state (toggles, selections)? → `this.state`
- No dynamic data loads at all? → `this.state` for everything

### Display vs. edit

**`this.data` is the source of truth for display** — render templates from `this.data`
directly, never from a `this.state` copy of it. The post-load re-render is gated on
`JSON.stringify(this.data)` changing, so a template reading from a `this.state` copy goes
stale after a save that returns identical values.

**`this.state` is the editor buffer**: when the user starts editing data the component
owns, clone `this.data` → `this.state`, mutate freely, then save and call `this.reload()`
to refetch `this.data` and discard `this.state`.

```javascript
async on_load() { this.data.values = await list_values(); }
_ensure_editing()  { if (!this.state.edits) this.state.edits = structuredClone(this.data.values); }
async _save() { await save_all(this.state.edits); this.state.edits = null; this.reload(); }
// Template: <% const rows = this.state.edits || this.data.values; %>
```

### Loading pattern

```javascript
async on_load() {
    const result = await list_products({page: 1});
    this.data.products = result.products;
    this.data.loaded = true;      // simple flag, set at the END
}
```

```jqhtml
<% if (!this.data.loaded) { %>
    Loading...
<% } else { %>
    <%-- show data --%>
<% } %>
```

Setting the flag last means a partially-populated `this.data` can never paint as if it
were complete.

### AJAX placement

Component AJAX belongs in `on_load()` (save handlers excepted). **Never re-fetch into
`this.data` from an event handler** — call `this.reload()` instead. `reload()` restores
`this.data` to the `on_create()` snapshot then re-runs `on_load()` only — **`on_create()`
is NOT called again** — which keeps the framework's caching, freezing and re-render
heuristics aligned with what the template sees.

```javascript
async add_item() {
    await add_item_request({name: 'Test'});
    this.reload();   // refreshes this.data via on_load(), reattaches handlers via on_ready()
}
```

The server round-trip is intentional: it is what guarantees the component shows what the
server actually stored.

---

## Re-render methods

- **`reload()`** — reset `this.data` to the `on_create()` snapshot → `on_load()` →
  `render()` → `on_ready()`. Use when `this.args` changed or data must be refetched.
  Debounced: rapid repeated calls coalesce into ONE execution.
- **`refresh()`** — a `reload()` that SKIPS the re-render and `on_ready()` when
  `this.data` came back unchanged. The right tool for polling or interval refresh; it is
  what prevents flicker on every tick.
- **`load()`** — re-runs `on_load()` only: no render, no `on_ready()`. Returns
  `true`/`false` for whether `this.data` changed, so you decide what to redraw next.
- **`render()` / `redraw()`** — re-execute the template → wait for children → `on_ready()`.
  Does NOT re-run `on_load()`. UI-only updates.
- **`render('sid')`** — re-render ONLY the element carrying that `$sid`, which must be
  marked `$redrawable` in the template. Child DOM elsewhere is untouched — use for
  counters, badges and live fragments instead of a full `render()`.
- **`stop()`** — destroy the component and all children; calls `on_stop()` if defined.

`render()` and `reload()` invalidate the sticky `ready` state first, so a `.ready()` or
`.on('ready')` registered mid-cycle waits for the NEW render instead of resolving against
the old one.

**`render()` destroys child DOM**: all child elements and child components are recreated,
and DOM handlers on them are lost. Re-register in `on_render()` (namespaced, idempotent) or
`on_ready()`. For ONE data-driven fragment, mark it `$redrawable $sid="x"` and call
`this.render('x')` instead.

---

## Caching and deduplication

Opt-in localStorage caching, enabled with `jqhtml.set_cache_key('myapp_v1.2.3_user_456')`
— include an app build hash, user id and session so the cache auto-clears when any change.
Behavior: cache hit → instant render → `on_load()` revalidates in background → re-render
if changed.

- Components with the same name and the same args loading at the same time share **one**
  `on_load()` call. Automatic, always on. Fewer network requests than component instances
  is expected.
- **Caching and deduplication key differently, deliberately.** CACHING keys plain data by
  CONTENT: null, booleans, numbers, strings, Dates, arrays and plain objects, in any
  nesting — so `$filters={status:'open'}` rebuilt on every render still hits the same
  entry. It DECLINES, never silently degrades, on a function, a class instance, a
  DOM/jQuery object, a circular structure, or anything over 500 bytes, marking the element
  `data-nocache="<arg>:<reason>"`. A key that dropped a callback would let two different
  arg sets share an entry and serve the wrong content — worse than not caching.
- DEDUPLICATION is stricter and does NOT use content keys: it needs primitive args, or a
  `_jqhtml_cache_id` property on the object. A deduplicated follower skips `on_load()`
  entirely with no revalidation, so a wrong key there is permanently wrong data; redundant
  requests are the cheaper failure.
- `cache_id()` can be overridden on the class to control the persisted cache key. It does
  **not** affect deduplication, which always keys off raw `this.args`.

```javascript
class ProductList extends Jqhtml_Component {
  cache_id() { return `products_${this.args.category}_page_${this.args.page}`; }
}
```

---

## Component API: DOM and component access

`$sid` = "scoped ID" — unique **within one component instance**, so two instances of the
same component never collide. It compiles to `id="<sid>:<cid>"`.

| From inside a component | Returns | Purpose |
|---|---|---|
| `this.$` | jQuery | The component's own root element |
| `this.$sid('name')` | jQuery | Child ELEMENT carrying `$sid="name"` |
| `this.sid('name')` | Component / null | Child COMPONENT instance (null if that node is not a component) |
| `this.closest(sel)` / `this.find(sel)` | Component / null | Component-aware traversal — match COMPONENTS only, never plain divs |
| `this.$.shallowFind(sel)` | jQuery | Direct-descendant matches only; does not recurse INTO a match |
| `this._cid` | string | This instance's unique id; what `$sid` scopes against |
| `this.instantiator()` | Component / null | The component whose template rendered this one |
| `$(selector).component()` | Component / null | Get the component instance from any jQuery element |
| `await $(sel).component().ready()` | Promise | Await initialization; also takes a callback |

`this.closest()` and `this.find()` accept a CSS selector, and a bare component name is
treated as its class selector — `this.closest('ParentDashboard')` and
`this.closest('.ParentDashboard')` are equivalent. Because every ancestor's class name is
stamped on the root, a base class name matches its subclasses too.

Standard jQuery works throughout: `this.$.addClass()`, `this.$.find()`, `this.$.fadeIn()`,
`this.$.on()`.

### `$sid` is TEMPLATE-ONLY

`$sid` is assigned **only in `.jqhtml` files** and is **never settable from JS**. The
jQuery layer throws if you hand-write a `data-sid` element, because such an element is
never bound to a component and `this.$sid()` could never find it.

`$id` is NOT a synonym. It was the original spelling, renamed to `$sid`, and now carries
no special meaning: `$id="x"` is an ordinary component argument like `$foo="x"`, so it
produces no scoped id. An un-migrated template fails silently.

To address DOM you created imperatively, keep **in-memory element references** (a `Map`
from key to element) or use CSS classes — never `data-*` tagging.

`$sid` targets should be defined in the template and rendered unconditionally: toggle
their visibility rather than gating the element behind an `if`, so the reference never
disappears.

---

## Events

```javascript
this.trigger('event_name', data);                                   // fire
this.sid('child').on('event_name', (component, data) => { ... });   // listen
```

- **`.on(event, cb)`** fires on every occurrence. **`.once(event, cb)`** fires once, then
  auto-removes. Both return `this` for chaining.
- **Both fire immediately if the event already happened**, receiving the DATA stored from
  the most recent `trigger()` — not `undefined`.
- **`this.invalidate('name')`** clears an event's already-occurred marker (registered
  handlers stay; they wait for the next `trigger()`). `render()`/`reload()` do this to
  `ready` internally.

**The key difference from jQuery**: events fired BEFORE handler registration still trigger
the callback when it is registered. This is deliberate — it solves the lifecycle timing
problem where a child fires an event before its parent has had a chance to listen. It is
also why persistent handlers belong in `on_create()`: registering in `on_ready()` risks
infinite loops from event replay.

**Never use `this.$.trigger()` for custom events** — jQuery's event system has none of the
replay semantics above. Use `this.trigger()`.

### Handler placement

| What | Where | Why |
|---|---|---|
| `this.on`/`once('event', ...)` | `on_create()` | Persists across renders; `on_ready()` risks replay loops |
| `this.sid('child').on('event')` | `on_ready()` | Children only guaranteed ready here |
| `this.$sid('elem').on('click')` | `on_render()` or `on_ready()` | Child DOM recreated on render; MUST deregister first (`.off('click.ns').on('click.ns')`) |

### Reserved names

**Never name a custom event** `create` / `load` / `loaded` / `ready` / `render` /
`rendered` / `stop`. These are lifecycle events fired internally with no payload, so a
same-named custom event collides and your handler receives the framework's payload-less
firings. Pick a distinct name — `preview_loaded`, not `loaded`.

**Never shadow a `Jqhtml_Component` method**: `reload` · `refresh` · `render` · `redraw` ·
`stop` · `ready` · `rendered` · `gate_load` · `sid` · `$sid` · `closest` · `find` ·
`instantiator` · `on` · `once` · `trigger` · `invalidate` · plus every lifecycle hook.
Overriding one is a deliberate OOP override for unusual edge cases, never a naming
convenience. Frameworks embedding JQHTML may patch further methods onto
`Component.prototype`; check yours before choosing a method name.

---

## Dynamic component creation

```javascript
// Destroys the existing component (if any) and creates a new one in its place
$(selector).component('ComponentName', { arg1: value1, arg2: value2 });

// Render a component into a container this component owns
this.$sid('result_container').component('MyComponent', { data: my_data });

// Create and get the instance in one chain
const c = $('<div>').component('UserCard', {user_id: 123}).appendTo('#container').component();
```

**Setter vs getter**: `$el.component('Name', args)` returns the **jQuery object** (so it
chains); `$el.component()` with no arguments returns the **component instance**.

**Class preservation**: only PascalCase component names (capital first letter, no `__`)
are replaced. Utility classes, BEM child classes (`Parent__child`) and all attributes are
preserved, so a container keeps its layout classes across repeated `.component()` calls.
A `class="..."` set at invocation is additive — it unions onto the root's existing classes.

**A name with no definition still mounts**, exactly like an undefined tag in a template: a
div carrying the component name as a class. Nothing throws, so JS-side composition can be
scaffolded out of names before any of them exist.

**Detached creation skips the first render.** A component created before it is in the DOM
(`$('<div>').component(...)` then appended) paints once, after `on_load()` finishes — so a
loading state never appears. Pass `_force_initial_render: true` if it must.

**The `val()` hook**: a component that defines `val(value)` (getter with no args, setter
with one) is auto-wired into jQuery's `.val()` on its root element, so `$(sel).val()`
delegates to the component. This is what makes input-style components behave like native
inputs.

---

## Communicating between components

- **Parent → child**: pass `this.args`, then `child.reload()` if the child must refetch.
  Or call a method on `this.sid('child')` from `on_ready()`.
- **Child → parent**: `this.trigger('saved', {id})` in the child; the parent listens with
  `this.sid('child').on('saved', ...)` in `on_ready()`.
- **Child → parent (alternative)**: pass a callback as an arg
  (`<Child $on_saved=this.handle_saved />`); the child calls `this.args.on_saved(id)`.
  Cleaner than an event when the parent already owns the child and is the only listener.
- **Never reach across the tree with global selectors.** `this.find()` / `this.closest()`
  are component-aware and scoped; a bare `$('.SomeComponent')` finds every instance on the
  page.
- **Never await a PARENT's `ready()` from a child's `on_ready()`.** Ready resolves
  bottom-up: the parent waits for all children before resolving its own, so the child would
  be waiting on something waiting on it. Deadlock. Use a callback arg or an event.

---

## Composing a page

Compose **logical concepts**, not visual primitives: `<UserCard>` rather than
`<div class="d-flex justify-content-between">`. A page template should read like a
well-engineered main routine — a sequence of named concepts.

**When to create a component:**

1. **Repetition** — the same pattern appears twice
2. **Logical concept** — it has domain-specific meaning
3. **Needs configuration** — it takes parameters
4. **Complex structure** — nested markup worth naming

**Never create components for the sake of components.** Extraction is evidence-driven,
never speculative: the bar is **two or more live call sites with the same shape**. Do not
build a component in anticipation of a second consumer that does not exist yet.

**Extract, lever, or promote:**

| Situation | Do this |
|---|---|
| An existing component fits | Use it |
| An existing component ALMOST fits | Add a small, additive **lever** (an arg): `$removable`, `$inline`, `$divided`. A lever's default rendering must be identical to before, and you carry the regression duty |
| Two or more sites hand-roll the same shape | Extract ONE component and converge the sites onto it |
| A needed widget RESEMBLES an existing one but has different domain semantics | Do NOT merge domains. Extract the shared display PRIMITIVE both can use, or an abstract base with two concrete variants |

A hand-authored seam is a smell pointing at a missing component lever: if several pages
"need" the same divider in the same place, the adjacent component needs a `$divided` arg.

**Displayed content is innerHTML** — `content()` or a named `<Slot:name>` — **never an
attribute.** Args carry DATA the component formats itself (`$user_id`, `$status_id`) and
behavioral flags (`$variant`, `$size`). `$label="Open Tasks"` traps authored content as
dead text; even a single word today may need markup tomorrow. Structural wrappers may
accept a plain-string `$title`/`$label` for convenience alongside a matching
`<Slot:title>` that wins when present — but HTML inside an arg string is always a defect.

**Validate variants loudly.** A component should throw unless `$variant` is one of its
known values; a fail-loud error beats a silently unstyled element.

**Each component owns its complete look**, in its own stylesheet wrapped in its own class
- see [Styling](#styling). Preserving a bespoke appearance is not a reason to skip
componentizing: the right output is a named, self-contained component carrying that look,
never page-local markup plus page-local CSS.

**Incremental scaffolding.** Undefined components render as a div carrying the component
name, so write the composition first and define the pieces afterwards:

```jqhtml
<Dashboard>
  <StatsPanel />
  <RecentActivity />
</Dashboard>
```

Nothing breaks, the page renders, and each name becomes a real component when you get to
it.

---

## Styling

JQHTML stamps every component's own class - and every ancestor's - on its root element,
which makes per-component style scoping automatic and is the basis of the whole
convention. `<Define:UserCard>` renders `<div class="UserCard Component">`, so
`.UserCard { ... }` reaches that component and nothing else.

Examples below are SCSS because nesting expresses the convention compactly. The
convention is not SCSS-specific: any preprocessor works, and so does plain CSS written
with explicit descendant selectors (`.UserCard .avatar { ... }`).

**One stylesheet per component, wrapped in exactly that component's class.**

```scss
.UserCard {
  display: flex;
  gap: var(--gap-sm);

  .avatar { width: 3rem; border-radius: 50%; }
  .meta   { flex: 1; }
  .status { color: var(--text-muted); }
}
```

**Never style another component's class from your file.** If `UserCard` needs a
`StatusBadge` to look different inside it, that is a `$variant` arg on `StatusBadge`, not
a selector reaching across the boundary. Cross-component selectors are how a component
stops owning its own appearance, and they break silently when either side moves.

**Child elements get simple, unprefixed class names** nested under the wrapper - the
wrapper IS the namespace, so `.avatar` inside `.UserCard` cannot collide with `.avatar`
inside anything else.

**BEM `Parent__child` is reserved for elements that must survive a `.component()`
re-init.** This is a real framework mechanic, not a style preference: when a component is
re-initialized on an element, the framework strips classes that begin with a capital
letter, but deliberately preserves lowercase/utility classes and any class containing
`__`. So an element you address from JS across a re-init should carry
`.UserCard__toolbar` rather than a plain `.toolbar`. Everything else should use the plain
nested form.

**Use design tokens, not hardcoded values**, and avoid inline fallbacks:

```scss
.UserCard { color: var(--text-primary); }              /* good */
.UserCard { color: #2c3e50; }                          /* hardcoded */
.UserCard { color: var(--text-primary, #2c3e50); }     /* fallback hides an undefined token */
```

A `var(--x, #hex)` fallback makes a missing token invisible - the page looks fine and the
token is never defined. Define the token once and drop the fallback.

**A component's look may span several files** (`user_card.scss` +
`user_card_mobile.scss`) provided every file wraps the same component class.

**Spacing: components style their interior, containers own the gaps between children.** A
component should not carry outer margins that assume where it will be placed, and content
inside a padded container should not cancel that padding from within - give the container
an arg instead. This is what keeps a component droppable anywhere without a negative-margin
clawback.

**Inline `<style>` (and `<script>`) tags are rejected in a `.jqhtml` template** - it is a
compile error. Styling belongs in the stylesheet, behavior in the companion `.js` or a
`<% %>` block.

---

## Documenting a component

Document `.jqhtml` files with template comments, which the compiler strips:

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

Include ARGS if the component takes arguments, DATA if it loads data, METHODS if the JS
class has public methods.

---

## Pitfalls

Remedies included. Most of these are silent, not thrown — the exceptions are marked.

1. **`<Define>` IS the element, not a wrapper.** Use `tag=""` to choose the rendered
   element; do not wrap it in another div. `tag=""` is **never inherited** — every
   `<Define:>` extending a base must repeat it or silently render a `div`.
2. **`this.data` starts as `{}`.** Set defaults in `on_create()`; it is writable ONLY in
   `on_create()` and `on_load()` and frozen everywhere else. *(Throws.)*
3. **`on_load()` may read `this.args` and write `this.data`, and nothing else.** DOM
   access, `this.state` and modifying `this.args` all throw at runtime. *(Throws.)*
4. **NEVER call `this.render()` in `on_load()`** — the automatic re-render already happens
   when `this.data` changes.
5. **`this.state` is for UI state; `this.args` + `reload()` is for re-fetching.** Never
   re-fetch into `this.data` from an event handler.
6. **`on_create`, `on_render` and `on_stop` must be synchronous.** `on_load`, `on_loaded`
   and `on_ready` may be async.
7. **`this.sid()` returns a component; `$(el).component()` returns a component;
   `this.$sid()` returns a jQuery element.** Mixing them up produces "not a function" at
   the call site.
8. **`@click` goes on child elements, NOT on `<Define>`** — Define attributes are component
   args, not DOM attributes. For a root-element click:
   `<% this.$.click(() => { ... }); %>`.
9. **`@click` values must be unquoted.** `@click="handler"` passes a string, not a
   function; the compiler rejects it. *(Throws.)*
10. **Wrapper components must render `<%= content() %>`** or the caller's child content is
    silently dropped.
11. **Never put `<% %>` inside a quoted attribute value.** Build the value in a `<% %>`
    block, then `class="<%= cls %>"`. Conditional logic toggles a WHOLE attribute *between*
    attributes. *(Throws.)*
12. **`<pre>` and `<textarea>` are raw-content elements.** Both interpolate `<%= %>`;
    `<pre>` also accepts nested markup and preserves whitespace exactly. `<textarea>` takes
    text only. Neither accepts a `<% %>` code block. *(Throws on misuse.)*
13. **An unquoted `$arg=expression` ends at the first space unless it is bracketed.**
    `$alert=_x > 0` fails; `$alert=(_x > 0)` works.
14. **`render()` destroys child DOM.** Every child element and child component is
    recreated, and DOM handlers on them are lost — re-register in `on_render()` (namespaced
    and idempotent) or `on_ready()`. For ONE data-driven fragment, mark it
    `$redrawable $sid="x"` and call `this.render('x')`.
15. **`on_render` fires more than once.** Namespace every DOM bind
    (`.off('click.ns').on('click.ns', ...)`) and guard every DOM injection against
    duplicate appends.
16. **Do not render display templates from a `this.state` copy of `this.data`.** The
    post-load re-render is gated on `JSON.stringify(this.data)` changing, so such a
    template goes stale after a save that returns identical values.
17. **Never tag imperative DOM with `data-sid`.** `$sid` is template-only, and the jQuery
    layer throws on the hand-written form. Use in-memory element references or CSS classes.
    *(Throws.)*
18. **Never name a custom event `create`/`load`/`loaded`/`ready`/`render`/`rendered`/`stop`**,
    and never shadow a `Jqhtml_Component` method name. Both collide silently with framework
    behavior.
19. **Never fire custom events with `this.$.trigger()`** — use `this.trigger()`, which has
    the replay semantics jQuery's does not.
20. **Non-primitive args disable load deduplication, and some disable caching.** Caching
    keys plain data by content, but a function, class instance, DOM object, circular
    structure or anything over 500 bytes declines (marked `data-nocache`). Deduplication
    needs primitives or a `_jqhtml_cache_id`.
21. **A tag is a component only if its first letter is uppercase.** `<user_card>` is never
    a component no matter what is registered.
22. **No inline `<script>` or `<style>` tags in a `.jqhtml` template.** Behavior goes in the
    companion `.js` or a `<% %>` block; styling goes in the component's stylesheet, wrapped
    in its own class. *(Throws.)*
23. **`on_stop()` is not guaranteed to fire** — a node removed outside the framework skips
    it. Do not put cleanup there that would be catastrophic if skipped.
24. **Undefined components render silently.** A typo'd component name does not error; it
    renders an empty div with that name as its class. If a region is mysteriously blank,
    check the spelling of the tag.

## Common mistakes, at a glance

| Wrong | Right | Why |
|---|---|---|
| `<Define:Button><div class="btn">` | `<Define:Button class="btn">` | Define IS the element |
| `<Define:Button><button>` | `<Define:Button tag="button">` | Use the tag attribute |
| `this.data.x = y` in `on_ready` | Set it in `on_load` | `this.data` frozen outside `on_create`/`on_load` |
| `this.$sid()` in `on_load` | Move to `on_ready` | `on_load` has no DOM access |
| `await fetch()` in `on_create` | Move to `on_load` | `on_create` must be sync |
| `this.render()` in `on_load` | Let the framework auto-render | It re-renders when `this.data` changes |
| `this.reload()` unguarded in `on_ready` | Guard with a flag | `reload()` triggers `on_ready` again — infinite loop |
| `refresh()` when a render is required | `reload()` | `refresh()` skips the render when data is unchanged |
| `@click="handler"` | `@click=this.handler` | Quoted passes a string, not a function |
| `<!-- comment -->` in `.jqhtml` | `<%-- comment --%>` | HTML comments are parsed, execute JS, and ship to the DOM |

---

## Debugging

```javascript
window.jqhtml.debug.verbose = true;   // detailed lifecycle logging
```

Or add `?debug=true` to the URL. Use verbose mode for lifecycle-ordering questions —
double renders, hook order, slow renders — which a single static render cannot show.

## Runtime configuration

```javascript
jqhtml.init($, { mode: 'production' });   // or jqhtml.configure({ mode: 'production' })
jqhtml.get_config();                       // read resolved settings
```

`mode` is `'development'` (default) or `'production'` and sets defaults for every flag; an
explicit flag in the same call overrides that default. Production is always opt-in.

| Flag | dev | prod | Effect |
|---|---|---|---|
| `warn_uncacheable_args` | on | off | Warns when a component with a custom `on_load()` gets a non-serializable arg and defines no `cache_id()` |
| `debug_attributes` | on | off | Emits `data-sid` and `data-cid` — debug mirrors of the scoped id and `_cid` |

Both are inspection-only. **Do not write selectors against `data-sid` or `data-cid`** —
they are absent in production.

## Server-side rendering

`@jqhtml/ssr` renders components on the server. The server emits placeholders:

```html
<div class="_Component_Init"
     data-component-init-name="ComponentName"
     data-component-args='{"key":"value"}'></div>
```

The client then calls `await jqhtml.boot()` to hydrate every placeholder into a live
component.
