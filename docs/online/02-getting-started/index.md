# Getting Started

This guide walks through creating your first JQHTML component and understanding the basic workflow.

## Installation

Install the core package:

```bash
npm install @jqhtml/core
```

JQHTML requires jQuery. The recommended setup loads jQuery via a global `<script>` tag before your bundle, with jQuery marked as an external in your bundler so the bundle uses the global instance:

```html
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="/dist/bundle.js"></script>
```

```javascript
// webpack.config.js
module.exports = {
  externals: { jquery: '$' }
};
```

With jQuery global before the bundle runs, `@jqhtml/core` attaches `.component()` automatically:

```javascript
import jqhtml from '@jqhtml/core';
```

If you instead bundle jQuery as an ES module import, `@jqhtml/core`'s auto-attach only fires if `window.jQuery` is already set by the time `@jqhtml/core` is imported. To avoid a silent `.component is not a function` failure, call the named `init()` export explicitly rather than relying on import ordering:

```javascript
import $ from 'jquery';
import jqhtml, { init } from '@jqhtml/core';

window.$ = window.jQuery = $;
init($);
```

Components extend `Jqhtml_Component`:

```javascript
import { Jqhtml_Component } from '@jqhtml/core';
```

## Your First Component

Create a simple greeting component.

**Template file** (`greeting.jqhtml`):

```jqhtml
<Define:Greeting class="greeting-box">
  <h2>Hello, <%= this.args.name %>!</h2>
  <p>Welcome to JQHTML.</p>
</Define:Greeting>
```

**Usage** (in another template or programmatically):

```jqhtml
<Greeting $name="World" />
```

**Rendered output**:

```html
<div class="Greeting Component greeting-box">
  <h2>Hello, World!</h2>
  <p>Welcome to JQHTML.</p>
</div>
```

Every component automatically receives two classes: the component name (`Greeting`) and `Component`.

## Adding Behavior

When a component needs JavaScript logic, create a matching class file.

**Template** (`counter.jqhtml`):

```jqhtml
<Define:Counter class="counter">
  <span $sid="display">0</span>
  <button $sid="increment">+</button>
</Define:Counter>
```

**JavaScript** (`counter.js`):

```javascript
class Counter extends Jqhtml_Component {
  on_create() {
    this.state.count = 0;
  }

  on_ready() {
    this.$sid('increment').on('click', () => {
      this.state.count++;
      this.$sid('display').text(this.state.count);
    });
  }
}
```

The `$sid` attribute creates scoped IDs that prevent conflicts when multiple instances exist. Access them with `this.$sid('name')`.

## Component File Structure

A component can consist of:

| Files | Description |
|-------|-------------|
| `.jqhtml` only | Template-only component (no behavior) |
| `.js` only | Behavior-only component (default template) |
| Both `.jqhtml` and `.js` | Template with behavior |
| Neither | Undefined component (renders as div) |

**Naming convention**: Filenames are typically `snake_case` (`user_card.jqhtml`) while component names are `PascalCase` (`UserCard`); any filename convention works.

```
components/
├── user_card.jqhtml
├── user_card.js
├── status_badge.jqhtml      # template only
└── data_fetcher.js          # behavior only
```

## Undefined Components

Components work before they're defined. This enables rapid prototyping:

```jqhtml
<Dashboard>
  <StatsPanel />
  <ActivityFeed />
  <QuickActions />
</Dashboard>
```

All render immediately as divs with component names as classes:

```html
<div class="Dashboard Component">
  <div class="StatsPanel Component"></div>
  <div class="ActivityFeed Component"></div>
  <div class="QuickActions Component"></div>
</div>
```

Style them with CSS using the component name:

```css
.Dashboard {
  display: grid;
  grid-template-columns: 2fr 1fr;
}

.StatsPanel {
  background: #f5f5f5;
  padding: 1rem;
}
```

Define templates when you need custom markup. Define JavaScript when you need behavior. The structure works from day one.

## Development Workflow

1. **Write structure** - Use semantic component names
2. **Style with CSS** - Target components by name
3. **Add templates** - When custom markup needed
4. **Add behavior** - When interactivity needed

This workflow lets you build entire page structures before implementing any components, then enhance incrementally.

## Loading Data

Components can fetch their own data:

**Template** (`user_card.jqhtml`):

```jqhtml
<Define:UserCard class="card">
  <h3><%= this.data.name %></h3>
  <p><%= this.data.email %></p>
</Define:UserCard>
```

**JavaScript** (`user_card.js`):

```javascript
class UserCard extends Jqhtml_Component {
  async on_load() {
    this.data = await fetch(`/api/users/${this.args.user_id}`)
      .then(r => r.json());
  }
}
```

**Usage** (in a template):

```jqhtml
<UserCard $user_id="123" />
```

The component fetches data in `on_load()`, then renders the template with `this.data` populated.

## Creating Components Programmatically

Use the jQuery plugin syntax:

```javascript
// Create a component
$('#container').component('UserCard', { user_id: 123 });

// Create and append
$('<div>')
  .component('UserCard', { user_id: 123 })
  .appendTo('#container');

// Get component instance from element
const card = $('#my-card').component();
console.log(card.data.name);
```

## Compilation

JQHTML templates compile to JavaScript. Use the `jqhtml-compile` CLI (installed with `@jqhtml/parser`):

```bash
npx jqhtml-compile input.jqhtml -o output.js
```

First-party bundler plugins are available for Vite and esbuild — [`@jqhtml/vite-plugin`](https://github.com/jqhtml/jqhtml-vite) and [`@jqhtml/esbuild-plugin`](https://github.com/jqhtml/jqhtml-esbuild) — which let you import `.jqhtml` files directly. For other pipelines, invoke `jqhtml-compile` as a build step.

## Next Steps

- [Template Syntax](../03-template-syntax/) - Learn the full template language
- [Components](../04-components/) - Deep dive into component structure
- [Lifecycle](../06-lifecycle/) - Understand when code runs

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/official/02_component_definition.md` - Component structure and registration
- `docs/official/12_incremental_scaffolding.md` - Undefined components and workflow

### Last Updated
2026-07-21

### Editorial Notes
- Focused on practical "get running quickly" content
- Showed the minimum needed to create and use a component
- Introduced incremental scaffolding early as it's a key differentiator
- Kept lifecycle details minimal - dedicated chapter covers this
- Installation section is brief since specific setup varies by project
- Did not cover server integration (has dedicated chapter)
- Omitted advanced features like slots, inheritance, caching
- Accuracy pass: fixed base class name to `Jqhtml_Component` (no export named
  `JqhtmlComponent` exists); rewrote Installation to show the global `<script>`
  tag + bundler-external pattern as primary, with the named `init($)` export as the
  explicit fallback for bundled jQuery (`init` is a named export only, not a
  property of the default export object; auto-attach only fires if
  `window.jQuery` is set before `@jqhtml/core` is imported); removed the
  `@jqhtml/webpack-loader` instructions (no first-party webpack integration
  ships); reworded the filename/component naming line; Counter example now
  uses `this.state.count` instead of a bare instance property
