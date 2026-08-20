# JQHTML

**A jQuery-first component templating framework.**

**[jqhtml.org](https://jqhtml.org/)** · **[Documentation](https://docs.jqhtml.org/)** · [npm](https://www.npmjs.com/org/jqhtml) · [GitHub](https://github.com/jqhtml)

JQHTML lets you compose **logical concepts** in your HTML — `<User_Card>`, `<Invoice_Status_Badge>` — instead of visual primitives with cryptic class names. Templates compile at build time to plain JavaScript. Components are genuine jQuery objects. There is no virtual DOM, no state-management layer, and no runtime template parsing: just templates that become functions and components that manipulate the DOM directly, with a deterministic 5-stage lifecycle (`create → render → on_render → load → ready`).

Built as a deliberate alternative to the modern JavaScript ecosystem's complexity and churn. Like jQuery itself: simple, solid, an API that never changes.

```jqhtml
<Define:Hello_World tag="div" class="greeting">
  <h1>Hello, <%= this.args.name %>!</h1>
  <button @click=this.handle_click>Wave</button>
</Define:Hello_World>
```

```javascript
import jqhtml from '@jqhtml/core';
import Hello_World from './hello_world.jqhtml';  // compiled template

jqhtml.register(Hello_World);
$('#app').component('Hello_World', { name: 'World' });
```

That's a complete component. Undefined components render immediately as placeholder `<div>`s (incremental scaffolding), so you can sketch an entire page in semantic tags before writing a single template.

---

## The 10 Most Important Facts About Using JQHTML

1. **Components ARE jQuery.** `this.$` is a genuine jQuery object, not a wrapper — every jQuery method works directly: `this.$.addClass()`, `this.$.fadeIn()`, `this.$.find()`.

2. **Every `.jqhtml` template IS a JavaScript function.** A template compiles to a single function that runs top to bottom, inserting the rendered elements exactly as they appear. `<% %>` drops you into raw JavaScript mid-markup, so variables, conditionals, and loops are just JavaScript in document order:
   ```jqhtml
   <% var foo = 3; %>
   <p>foo is <%= foo %></p>
   <% if (foo > 2) { %><span>big</span><% } %>
   ```

3. **The `<Define:Name>` tag IS the root element** — it becomes the DOM node (default `<div>`, override with `tag="button"` etc.) and automatically gets two classes: the component name and `Component`.

4. **The lifecycle is deterministic and has 5 stages:** `create → render → on_render → load → ready`. Children boot in parallel; `ready` resolves bottom-up (all children ready before the parent's `on_ready()` runs). No race conditions.

5. **`$` attributes are component parameters** (`this.args`), and quoting matters: `$count="5"` passes the string `"5"`, `$count=5` passes the number `5`, `$user=this.data.user` passes an object reference, `$on_save=this.handle_save` passes a callback.

6. **`this.data` is frozen except inside `on_load()`** — the only place to load API data. Any change to `this.data` triggers an automatic re-render (the double-render pattern: first render shows the loading state, second shows data). Never call `this.render()` manually inside `on_load()`.

7. **Three state containers with distinct jobs:** `this.args` (configuration — change it, then `this.reload()`), `this.data` (API data, cached and frozen), `this.state` (free-form component-local values: timers, flags, connections).

8. **`$sid` gives you collision-free scoped IDs** (and `@` attributes bind events): `<button $sid="save" @click=this.save>` → `this.$sid('save')` returns the jQuery element; `this.sid('child')` returns a child component instance.

9. **Composition is built in:** `<%= content() %>` renders inner content, `<Slot:name>` provides named slots, and templates inherit via `extends=""`, the JS prototype chain, or automatically when a template contains only slots.

10. **Updating is one method call:** `this.reload()` re-fetches data and re-renders (debounced); `this.refresh()` does the same but skips the re-render when data hasn't changed (perfect for polling); `this.render('sid')` redraws a single `$redrawable` element. Opt-in stale-while-revalidate caching via `jqhtml.set_cache_key()` makes repeat visits render instantly from localStorage.

---

## Packages

All packages are published on npm under the **[@jqhtml organization](https://www.npmjs.com/org/jqhtml)**; source lives in the **[jqhtml GitHub organization](https://github.com/jqhtml)**.

This repository (the core monorepo):

| Package | Purpose |
|---|---|
| [`@jqhtml/core`](./packages/core) | Runtime: component system, lifecycle, jQuery integration (peer dep: jQuery ^3.7) |
| [`@jqhtml/parser`](./packages/parser) | Compiler: `.jqhtml` → JavaScript, with sourcemaps; ships the `jqhtml-compile` CLI |
| [`@jqhtml/ssr`](./packages/ssr) | Server-side rendering for SEO and hydration |
| [VS Code extension](https://github.com/jqhtml/jqhtml-vscode) | Syntax highlighting & language support for `.jqhtml` files (separate repo) |

Companion repos in the organization:

| Repo | Purpose |
|---|---|
| [`jqhtml-vite`](https://github.com/jqhtml/jqhtml-vite) | [`@jqhtml/vite-plugin`](https://www.npmjs.com/package/@jqhtml/vite-plugin) — compile `.jqhtml` templates in Vite builds |
| [`jqhtml-esbuild`](https://github.com/jqhtml/jqhtml-esbuild) | [`@jqhtml/esbuild-plugin`](https://www.npmjs.com/package/@jqhtml/esbuild-plugin) — compile `.jqhtml` templates in esbuild builds |
| [`jqhtml-laravel`](https://github.com/jqhtml/jqhtml-laravel) | `jqhtml/laravel` composer package — Blade precompiler for jqhtml component syntax in Laravel (in development, installs via `dev-main`) |

## Using JQHTML in Your Project

```bash
npm install @jqhtml/core @jqhtml/parser
```

**With a bundler**, use the first-party plugin for your tool — [`@jqhtml/vite-plugin`](https://github.com/jqhtml/jqhtml-vite) or [`@jqhtml/esbuild-plugin`](https://github.com/jqhtml/jqhtml-esbuild) — and `.jqhtml` imports just work.

**Without a bundler** (or in any other pipeline), compile templates with the CLI:

```bash
# Compile a template to an ES module
npx jqhtml-compile user_card.jqhtml --format esm --sourcemap -o user_card.js

# Other formats: iife (registers with window.jqhtml), cjs, umd
npx jqhtml-compile --help
```

Then register and mount:

```javascript
import jqhtml from '@jqhtml/core';
import User_Card from './user_card.js';

jqhtml.register(User_Card);                       // register the compiled template
$('#container').component('User_Card', { user_id: 123 });
```

Components with behavior pair a `.jqhtml` template with a JS class of the same name:

```javascript
class User_Card extends Jqhtml_Component {
  async on_load() {
    this.data = await fetch(`/api/users/${this.args.user_id}`).then(r => r.json());
  }
}
jqhtml.register(User_Card);
```

## Building From Source

```bash
git clone https://github.com/jqhtml/jqhtml.git
cd jqhtml
npm install
npm run build        # builds parser, then core (see build.sh)
```

Build output lands in `packages/*/dist/`.

## Running the Tests

```bash
cd tests && ./run-all-tests.sh  # full behavioral suite (89 scenarios × 3 cache modes)

npm run test:parser             # parser unit tests
npm run test:core               # core unit tests
```

Each directory under `tests/` is a self-contained behavioral scenario that compiles real templates, bundles them, and verifies rendered output in a real browser.

## Gallery Examples

*Coming soon — a gallery of live JQHTML examples will be published at:* **URL pending**

## Documentation

**Full documentation: [docs.jqhtml.org](https://docs.jqhtml.org/)** — tutorial-style chapters
covering template syntax, the lifecycle, scoped IDs, slots and inheritance, caching, and
production configuration. Start there.

The project homepage is **[jqhtml.org](https://jqhtml.org/)**.

Documentation also ships in this repo, which is useful offline or when working against a
specific commit:

- **[CLAUDE.md](./CLAUDE.md)** — agent & developer quickstart (the fastest complete overview)
- **[docs/reference/](./docs/reference/)** — detailed feature specifications
- **[docs/online/](./docs/online/)** — the source the documentation site is built from
- **[docs/reference/LLM_REFERENCE_OFFICIAL_07_26.md](./docs/reference/LLM_REFERENCE_OFFICIAL_07_26.md)** — drop-in LLM context for AI-assisted development with JQHTML

---

## License

MIT — Copyright (c) 2026 [HansonXyz](https://hanson.xyz/)

---

**JQHTML v2:** Component system for mechanical thinkers who compose logical concepts instead of wrestling cryptic class names. Built on jQuery. No virtual DOM. No state management. Clean, honest, and deterministic.
