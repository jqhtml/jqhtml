# Component Methods

JQHTML components provide methods to control their lifecycle after initialization. These methods allow re-rendering, data reloading, and cleanup.

## render()

Re-renders the component template with the current `this.data`.

```javascript
// Re-render entire component
await this.render();

// Re-render only a $redrawable element (see Scoped IDs chapter)
await this.render('counter');
```

**What it does:**
1. Invalidates the sticky `'ready'` state, so new `.on('ready')` handlers wait for this render instead of firing immediately based on the previous lifecycle
2. Executes the template with current `this.data`
3. Waits for all child components to be ready
4. Calls `on_ready()`
5. Triggers `'ready'` event

**Does NOT call:** `on_create()`, `on_load()`

**Note:** Since `this.data` is read-only after `on_load()`, use `reload()` to fetch new data and re-render. `render()` is called internally by `reload()` after data changes.

For selective re-rendering of specific elements, see [$redrawable in Scoped IDs](../10-scoped-ids/#selective-re-rendering-with-redrawable).

## redraw()

An alias for `render()` — same arguments, same behavior, same return value.

```javascript
await this.redraw();          // identical to this.render()
await this.redraw('counter'); // identical to this.render('counter')
```

It exists for readability: `redraw()` reads better where the intent is "repaint what is
already on screen," while `render()` reads better as the counterpart to `on_render()`. Pick
whichever makes the calling code clearer; there is no behavioral difference to weigh.

## load()

Re-fetches data by calling `on_load()` without re-rendering. Returns `true` if data changed, `false` if unchanged.

```javascript
class OrderEditor extends Jqhtml_Component {
  on_ready() {
    this.$sid('save').on('click', async () => {
      // Save to backend
      await fetch('/api/save', { method: 'POST', body: JSON.stringify(this.state.form) });

      // Re-fetch data, check if it changed
      const changed = await this.load();
      if (changed) {
        this.render('order_summary');  // Only update specific section
      }
    });
  }
}
```

**What it does:**
1. Restores `this.data` to `on_create()` state
2. Calls `on_load()` on detached proxy (same restrictions as boot)
3. Atomically updates `this.data` and re-freezes it
4. Updates cache if data changed
5. Calls `on_loaded()` on the real component and triggers the `'loaded'` event

**Does NOT call:** `on_render()`, `on_ready()`, does NOT re-render

**Pattern:** `load()` invokes `on_load()`, just as `render()` invokes `on_render()`.

**When to use:** After saving data to backend, when you want to control what re-renders (or skip re-rendering entirely).

## reload()

Re-fetches data via `on_load()` and re-renders. This is the standard way to refresh a component.

```javascript
class ProductList extends Jqhtml_Component {
  on_ready() {
    // Refresh button
    this.$sid('refresh').on('click', async () => {
      await this.reload();  // Fetches fresh data
    });

    // Filter change
    this.$sid('filter').on('change', async (e) => {
      this.args.filter = e.target.value;
      await this.reload();  // Re-fetch with new filter
    });
  }
}
```

**What it does:**
1. Restores `this.data` to `on_create()` state
2. Calls `on_load()` to fetch fresh data
3. Re-renders if data changed
4. Waits for children and calls `on_ready()`

**Debouncing:** Multiple rapid calls are coalesced into a single execution.

**Cache integration:** If `this.args` changed, checks cache first for instant rendering, then revalidates in background.

## refresh()

Like `reload()`, but only re-renders if data actually changed.

```javascript
class LiveFeed extends Jqhtml_Component {
  on_ready() {
    // Poll every 5 seconds
    setInterval(async () => {
      await this.refresh();  // Only updates if data changed
    }, 5000);
  }
}
```

**Use when:** Polling for updates or background synchronization. Avoids unnecessary DOM updates when server data hasn't changed.

## ready()

Returns a promise that resolves when the component is fully initialized.

```javascript
// Create component programmatically
this.$sid('container').component('DataGrid', { endpoint: '/api/users' });

// Wait for it to be ready
const grid = this.sid('container');
await grid.ready();

// Now safe to interact
grid.apply_filter('active');
```

**With callback:**

```javascript
grid.ready(() => {
  console.log('Grid is ready!');
  grid.apply_filter('active');
});
```

**Behavior:**
- If already ready: resolves immediately
- If not ready: resolves when `'ready'` event fires

**During reload:** When you call `reload()` on an already-ready component, the framework automatically invalidates the ready state. This means any new `ready()` calls or `.on('ready')` handlers will wait for the reload to complete, rather than resolving immediately based on the previous lifecycle.

## rendered()

Returns a promise that resolves when the component's render chain completes, but **before** the async ready phase.

```javascript
await component.rendered();
// DOM is stable, on_render has completed
// But children may still be loading data
```

**Use case:** Waiting for a component's DOM to be ready without waiting for all descendants to load their data. This is primarily useful for SPA layouts where you need to update navigation state as soon as the layout renders, without waiting for the page content to fully load.

**When to use:**
- `ready()` - 99% of cases (wait for full initialization)
- `rendered()` - Niche use when you need early DOM access before children finish loading

## stop()

Stops the component and all its children. Calls `on_stop()` for cleanup.

```javascript
class LiveChart extends Jqhtml_Component {
  on_ready() {
    this.poll_timer = setInterval(() => this.fetch_data(), 5000);
    this.ws = new WebSocket('ws://data-feed.com');
  }

  on_stop() {
    // Clean up resources
    clearInterval(this.poll_timer);
    this.ws.close();
  }
}

// Later
const chart = $('#live-chart').component();
chart.stop();          // Synchronous cleanup
$('#live-chart').remove();  // Safe to remove DOM
```

**What it does:**
1. Recursively stops all child components (each child is stopped independently, in the same way as below)
2. Sets `_Component_Stopped` class
3. Calls `on_stop()` lifecycle hook
4. Triggers `stop` event

**Fast path:** If a component has no custom `on_stop()` override AND no `.on('stop', ...)` listeners registered at the time `stop()` is called, the framework skips steps 2-4 entirely as an optimization — no `_Component_Stopped` class is added, and the `stop` event does not fire. Only components with a custom `on_stop()` or a registered `.on('stop', ...)` listener get the full cleanup path.

**Does NOT** remove DOM (caller is responsible).

## Method Comparison

| Method | Calls on_load() | Calls on_ready() | Redraws DOM | Use Case |
|--------|-----------------|------------------|-------------|----------|
| `load()` | Yes | No | No | Re-fetch data only (you control next step) |
| `render()` | No | Yes | Yes | Re-render with current data |
| `redraw()` | No | Yes | Yes | Alias for `render()` |
| `reload()` | Yes | Yes | Conditional* | Refresh data from server |
| `refresh()` | Yes | Conditional | Conditional | Poll for changes |
| `ready()` | No | No | No | Wait for full initialization |
| `rendered()` | No | No | No | Wait for render chain only |
| `stop()` | No | No | No | Cleanup before removal |

\* Only re-renders if data changed or didn't render from cache yet.

**`on_viewport_resize()` follows the render and ready columns.** The hook fires after every `on_render()` and after every `on_ready()`, so any method that redraws the DOM or calls `on_ready()` also fires it. `load()` does neither, so it does not. See [Lifecycle](../06-lifecycle/).

## Common Patterns

### Filter and Pagination

```javascript
class UserList extends Jqhtml_Component {
  on_ready() {
    this.$sid('filter').on('change', async (e) => {
      this.args.filter = e.target.value;
      this.args.page = 1;  // Reset to first page
      await this.reload();
    });

    this.$sid('next_page').on('click', async () => {
      this.args.page++;
      await this.reload();
    });
  }
}
```

### Programmatic Component Creation

```javascript
async create_child() {
  // Create component
  this.$sid('container').component('UserCard', { user_id: 123 });

  // Wait for it to be ready
  const card = this.sid('container');
  await card.ready();

  // Interact with it
  card.highlight();
}
```

### Auto-Refresh with Cleanup

```javascript
class Dashboard extends Jqhtml_Component {
  on_ready() {
    this.refresh_timer = setInterval(async () => {
      await this.refresh();
    }, 30000);
  }

  on_stop() {
    clearInterval(this.refresh_timer);
  }
}
```

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/official/14_lifecycle_complete_specification.md` - Complete method documentation

### Last Updated
2026-08-19

### Editorial Notes
- Focused on the 7 main methods: load, render, reload, refresh, ready, rendered, stop
- Omitted reinitialize() as it's less commonly used
- refresh() vs reload() distinction is important
- load() vs reload() distinction added - load() is data-only, reload() is data+render
- rendered() is niche - kept brief with clear "99% use ready()" guidance
- Comparison table helps choose the right method
- Common patterns section shows real-world usage
- Kept technical details minimal - developers learn by using
- 2025-12-26: Added note about ready() behavior during reload (invalidate paradigm)
- 2026-02-20: Added load() method documentation
- 2026-07-21: Accuracy pass - render() now documented as also invalidating the sticky 'ready' state (matches reload()'s behavior); load()'s "What it does" now notes it calls on_loaded() and triggers 'loaded'; stop() rewritten to describe the fast-path optimization (skips the _Component_Stopped class and stop event when there's no custom on_stop() and no registered 'stop' listener); corrected JqhtmlComponent references to Jqhtml_Component. The `await this.render()` examples were verified against current code and are correct as written - render()/redraw() properly return a promise that resolves after the full render lifecycle.
- 2026-08-07: Noted that on_viewport_resize() tracks the render/ready columns of the comparison table — the hook is documented in full in chapter 06, so only the interaction with these methods is stated here.
- 2026-08-19: Promoted `redraw()` from a trailing sentence in the render() section to its own heading and a comparison-table row. It is a true alias with nothing to explain, so the section stays short — the problem was findability, not missing detail.
