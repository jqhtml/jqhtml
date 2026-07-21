# Lifecycle

JQHTML components follow a deterministic lifecycle with six hooks you can implement. Understanding when each runs is essential for proper component development.

## Lifecycle Overview

```
create → render → on_render → load → on_loaded → [re-render if data changed] → [wait for children] → ready
```

| Hook | Async | Purpose |
|------|-------|---------|
| on_create | No | Synchronous setup, set data defaults |
| on_render | No | Immediate post-render, hide uninitialized UI |
| on_load | Yes | Fetch data from APIs |
| on_loaded | Yes | Post-load processing (e.g. clone `this.data` into `this.state`) |
| on_ready | Yes | Full initialization, DOM manipulation, event binding |
| on_stop | No | Cleanup (timers, connections) |

**Key behavior:** After `on_load()` completes, `on_loaded()` runs on the real component with `this.data` frozen but `this.$`/`this.state` accessible. If `on_load()` modified `this.data`, the component then re-renders automatically. Finally it waits for all children to complete before calling `on_ready()`.

## 1. create (on_create)

Called once before the component renders. Use for synchronous setup.

```javascript
class UserCard extends Jqhtml_Component {
  on_create() {
    // Set default values
    this.is_expanded = false;
    this.max_items = this.args.max || 10;

    // Set data defaults
    this.data.loaded = false;
    this.data.items = [];
  }
}
```

**Rules:**
- Must be synchronous (no `async`/`await`)
- No DOM manipulation (component not rendered yet)
- No API calls
- Set initial properties and data defaults here

## 2. render

The template executes and DOM is created. Not overridable.

On first render, `this.data` contains only what `on_create()` set (starts as `{}`). Use a flag to detect loading state:

```jqhtml
<Define:UserCard>
  <% if (this.data.loaded === false) { %>
    <div class="loading">Loading...</div>
  <% } else { %>
    <h3><%= this.data.name %></h3>
  <% } %>
</Define:UserCard>
```

```javascript
class UserCard extends Jqhtml_Component {
  on_create() {
    this.data.loaded = false;  // Flag for template to check
  }

  async on_load() {
    this.data = await fetch(`/api/users/${this.args.user_id}`).then(r => r.json());
    this.data.loaded = true;  // Triggers re-render with real data
  }
}
```

## 3. on_render

Called immediately after render, before children are ready. Use to prevent visual glitches.

```javascript
class ProductGrid extends Jqhtml_Component {
  on_render() {
    // Hide until fully loaded
    this.$.css('opacity', '0');
    this.$sid('status').text('Loading...');
  }

  on_ready() {
    // Show when ready
    this.$.animate({opacity: 1}, 300);
  }
}
```

**Rules:**
- Must be synchronous
- Fires before `on_ready()`
- Doesn't wait for children
- Use for immediate visual setup

## 4. load (on_load)

Fetch asynchronous data. This is the **only place** to populate `this.data` from APIs.

```javascript
class UserCard extends Jqhtml_Component {
  async on_load() {
    this.data = await fetch(`/api/users/${this.args.user_id}`)
      .then(r => r.json());
  }
}
```

**Rules:**
- Can be async
- **No DOM manipulation** - siblings run in parallel
- **Only modify `this.data`**
- No access to child components

## 5. on_loaded

Called after `on_load()` completes, on the real component (not a detached proxy). `this.data` is frozen (read-only) here, but `this.$`, `this.state`, and `this.args` are all accessible.

**Primary use case:** cloning `this.data` into `this.state` for widgets that need to manipulate loaded data locally without triggering reloads or re-renders.

```javascript
class TodoBoard extends Jqhtml_Component {
  async on_load() {
    this.data.todos = await fetch('/api/todos').then(r => r.json());
  }

  on_loaded() {
    // this.data is frozen - clone into this.state for in-memory manipulation
    this.state.todos = [...this.data.todos];
  }

  on_ready() {
    this.$sid('todo_list').on('click', '.complete-btn', (e) => {
      const id = $(e.target).data('id');
      // Mutate this.state freely - no freeze, no re-render
      this.state.todos.find(t => t.id === id).completed = true;
    });
  }
}
```

After `on_loaded()` completes, the framework also fires the `'loaded'` event (see [Lifecycle Events](#lifecycle-events)).

**Rules:**
- Can be async
- `this.data` is read-only
- `this.$`, `this.state`, `this.args` are all accessible
- Fires `'loaded'` event when it completes
- Suppressed by the `_load_only` and `_load_render_only` truncation flags (see below)

## 6. Re-render (if data changed)

After `on_load()` completes, if `this.data` was modified, the component automatically re-renders:

1. Template executes again with populated `this.data`
2. `on_render()` fires again
3. New child components are created (if template generates them)

This is not a hook you implement—it happens automatically.

## 7. Wait for children

Before `on_ready()` fires, the framework waits for all child components to complete their lifecycles. Children's `on_ready()` runs before parent's `on_ready()`.

This is not a hook you implement—it happens automatically.

## 8. ready (on_ready)

Component is fully initialized. All children are ready. Safe for DOM manipulation.

```javascript
class UserCard extends Jqhtml_Component {
  on_ready() {
    // Attach event handlers
    this.$sid('edit_btn').on('click', () => this.edit());

    // Access child components
    const child = this.sid('child_component');
    child.on('change', () => this.handle_change());

    // DOM manipulation
    if (this.data.is_admin) {
      this.$sid('admin_section').show();
    }
  }
}
```

**Guarantees:**
- All data is loaded
- All children are ready
- Safe to manipulate DOM
- Safe to access child components

## Double-Render Example

A typical component renders twice: first with loading state, then with data.

### The Pattern

```jqhtml
<Define:ProductList>
  <% if (!this.data.loaded) { %>
    <div class="spinner">Loading...</div>
  <% } else { %>
    <% for (let product of this.data.products) { %>
      <ProductCard $product_id=product.id />
    <% } %>
  <% } %>
</Define:ProductList>
```

```javascript
class ProductList extends Jqhtml_Component {
  on_create() {
    this.data.products = [];
    this.data.loaded = false;
  }

  async on_load() {
    this.data.products = await fetch('/api/products').then(r => r.json());
    this.data.loaded = true;
    // Automatic re-render triggered because this.data changed
  }

  on_ready() {
    // Fires once, after second render, all ProductCard children ready
  }
}
```

## Execution Order

For a component tree:

```
ProductList
├─ ProductCard (1)
├─ ProductCard (2)
└─ ProductCard (3)
```

Execution:

1. **ProductList.on_create()** sets defaults
2. **ProductList renders** (first render, shows loading)
3. **ProductList.on_load()** fetches products
4. **ProductList.on_loaded()** runs (data frozen, `this.$`/`this.state` accessible)
5. **ProductList re-renders** (data populated, creates ProductCard children)
6. **All ProductCard lifecycles run** (on_create → render → on_load → on_loaded → on_ready)
7. **Wait for all ProductCard.on_ready()** to complete
8. **ProductList.on_ready()** runs last

Children's `on_ready()` always completes before parent's `on_ready()`.

## Lifecycle Rules Summary

| Method | Async | DOM Access | this.data |
|--------|-------|------------|-----------|
| on_create | No | No | Set defaults |
| on_render | No | Yes (basic) | Read only |
| on_load | Yes | **No** | Load from API |
| on_loaded | Yes | Yes | Read only |
| on_ready | Yes | Yes | Read only |
| on_stop | No | Yes | Read only |

## on_stop

Called when component is explicitly stopped or replaced. Use for cleanup.

```javascript
class LiveChart extends Jqhtml_Component {
  on_ready() {
    this.timer = setInterval(() => this.refresh(), 5000);
  }

  on_stop() {
    clearInterval(this.timer);
    this.ws?.close();
  }
}
```

**Note:** `on_stop()` is not guaranteed to run in all circumstances (e.g., if the DOM node is removed without going through the framework). Don't rely on it for critical cleanup that would cause problems if skipped.

## Lifecycle Truncation Flags

Two flags truncate the lifecycle for preloading scenarios — warming the data cache without firing DOM hooks.

### `_load_only`

Runs `on_create()` + `on_load()` only. No render, no children created, no DOM hooks.

```javascript
$('<div>').component('ProductList', { category: 'electronics', _load_only: true });
// ProductList.on_load() fires and populates cache. No DOM created.
```

### `_load_render_only`

Runs `on_create()` + render + `on_load()` + re-render. Children are created and their `on_load()` fires too. All DOM hooks (`on_render`, `on_loaded`, `on_ready`) are suppressed across the entire tree.

```javascript
$('<div>').component('DashboardPage', { user_id: 123, _load_render_only: true });
// Every component's on_load() fires. No on_render/on_loaded/on_ready anywhere.
```

Both flags cascade from parent to children automatically. A child can opt out by explicitly setting the flag to `false`.

## Detached Element Optimization

Components created on elements not in the DOM (`$('<div>').component(...)`) automatically skip the initial render and render once after `on_load()` completes. This means detached components won't show a loading spinner — they render directly with loaded data.

This is transparent in most cases. If you need the loading state visible (e.g., you plan to append the element before `on_load()` finishes), pass `_force_initial_render`:

```javascript
const $card = $('<div>').component('UserCard', { _force_initial_render: true });
$('#container').append($card);  // Loading spinner visible immediately
```

## Lifecycle Events

Each lifecycle stage triggers an event you can listen to:

| Event | When It Fires |
|-------|---------------|
| `'create'` | After on_create() completes |
| `'render'` | After each render completes |
| `'load'` | After on_load() completes |
| `'loaded'` | After on_loaded() completes (data frozen, DOM accessible) |
| `'rendered'` | Once, after final render chain completes |
| `'ready'` | After on_ready() completes |
| `'stop'` | When component is stopped |

```javascript
class DataPanel extends Jqhtml_Component {
  on_create() {
    // Listen for 'ready' event
    this.on('ready', () => {
      console.log('Component fully initialized');
    });
  }
}
```

**Retroactive firing:** If you subscribe to an event after it occurred, the callback fires immediately. This prevents race conditions when accessing component state.

### .once() - One-Time Event Listener

Use `.once()` when you only need a callback to fire a single time:

```javascript
// Wait for component to load, but only react once
component.once('loaded', (comp) => {
  console.log('Data loaded — runs exactly once');
});
```

If the event already occurred, the callback fires immediately and is **not** registered as a listener. If the event hasn't occurred yet, it registers, fires on the first occurrence, then auto-deregisters. Returns `this` for chaining.

## Invocation / Hook Pattern

JQHTML follows a clean pattern: developer-callable methods invoke their corresponding `on_` hooks.

| You call | Framework executes | Purpose |
|----------|-------------------|---------|
| `render()` | `on_render()` | Re-render DOM with current data |
| `load()` | `on_load()` | Re-fetch data only |
| `reload()` | `on_load()` + `render()` | Re-fetch AND re-render |

### load() - Re-fetch Data Without Re-rendering

Call `load()` when you want fresh data but don't want an automatic re-render:

```javascript
class InvoiceEditor extends Jqhtml_Component {
  on_ready() {
    this.$sid('save_btn').on('click', async () => {
      await fetch('/api/save', { method: 'POST', body: JSON.stringify(this.state.form) });

      const changed = await this.load();  // Re-fetch, returns true/false
      if (changed) {
        this.render('status');  // Only re-render what you need
      }
    });
  }
}
```

`load()` runs `on_load()` with the same restrictions as during boot (data unfrozen, everything else blocked), then atomically updates `this.data`.

## Common Mistakes

| Wrong | Right | Why |
|-------|-------|-----|
| `await fetch()` in on_create | Move to on_load | on_create must be sync |
| `this.$sid()` in on_load | Move to on_ready | No DOM in on_load |
| `this.data.x = y` in on_ready | Set in on_load | data frozen after on_load |
| Skip loading state in template | Check `this.data` empty | First render has no data |
| Call `this.on_load()` directly | Use `this.load()` | load() handles proxy isolation and data freeze |

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/official/14_lifecycle_complete_specification.md` - Complete lifecycle specification

### Last Updated
2026-07-21

### Editorial Notes
- Focused on the practical "what goes where" rather than internal mechanisms
- Added invocation/hook pattern section (load→on_load, render→on_render)
- Double-render pattern is critical concept - emphasized with example
- Kept state management brief since it has dedicated chapter (07)
- 2026-03-06: Added lifecycle truncation flags section (_load_only, _load_render_only)
- 2026-07-21: Added on_loaded() as the sixth lifecycle hook (was previously undocumented despite being a real overridable method fired between on_load() and re-render/ready; also referenced in the Lifecycle Events table). Updated overview diagram, hooks table, rules summary, and execution-order walkthrough accordingly. Also normalized JqhtmlComponent → Jqhtml_Component to match the actual runtime export.
- Component methods (render, reload, etc.) covered briefly since they have dedicated chapter (12)
- Rules summary table provides quick reference
- Common mistakes table addresses frequent issues
- Omitted parallelization details (depth-ordered execution) - too internal
- Omitted future caching feature discussion
