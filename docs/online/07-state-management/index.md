# State Management

JQHTML components use three properties for state: `this.args`, `this.data`, and `this.state`. Each has a specific purpose—but the conventions exist for **caching benefits**, not arbitrary rules.

## Why These Conventions Exist

Using `on_load()` with `this.args` and `this.data` enables the framework to cache data. When a user navigates back to a page, cached data renders instantly while fresh data loads in the background. Without proper use of `on_load()`, you'll always see loading artifacts.

For simple components that don't load data, you have flexibility—templates can read from `this.args`, `this.state`, or any property. But following conventions makes code predictable to other developers (principle of least surprise).

## The Three State Properties

| Property | Purpose | Set Where | Mutable |
|----------|---------|-----------|---------|
| `this.args` | Configuration | `$` attributes | Yes (except in on_load) |
| `this.data` | API-loaded data | on_load() | Only in on_create/on_load |
| `this.state` | Local UI state | Anywhere | Yes |

## this.args

Component configuration that controls what data to load. Passed via `$` attributes.

```jqhtml
<UserCard $user_id="123" $filter="active" />
```

```javascript
class UserCard extends Jqhtml_Component {
  on_create() {
    // Set defaults for optional args
    this.args.filter = this.args.filter || 'all';
  }

  async on_load() {
    // Read args to determine what to fetch
    this.data = await fetch(`/api/users/${this.args.user_id}?filter=${this.args.filter}`)
      .then(r => r.json());
  }

  on_ready() {
    // Change args and reload
    this.$sid('filter').on('change', async (e) => {
      this.args.filter = e.target.value;
      await this.reload();  // Re-fetch with new filter
    });
  }
}
```

**Key rules:**
- Read-only in `on_load()`
- Modify in `on_ready()` then call `reload()`
- Used as cache key (see [Caching & Performance](../14-caching-and-performance/))

## this.data

Data loaded from APIs. Only modify in `on_create()` (defaults) and `on_load()` (fetched data).

```javascript
class ProductList extends Jqhtml_Component {
  on_create() {
    // Set defaults before first render
    this.data.products = [];
    this.data.loaded = false;
  }

  async on_load() {
    // Fetch from API
    this.data.products = await fetch('/api/products').then(r => r.json());
    this.data.loaded = true;
    // Automatic re-render triggered
  }

  on_ready() {
    // Read-only here
    console.log(this.data.products.length);

    // Cannot modify:
    // this.data.count = 5;  // Error!
  }
}
```

**Key rules:**
- Frozen after `on_create()` completes
- Unfrozen during `on_load()` only
- Restored to `on_create()` state before each `on_load()`
- Modifications trigger automatic re-renders
- Used for caching

## this.state

Local component state that doesn't come from APIs. Use for UI state, timers, flags.

**Important:** `this.state` has no special meaning to JQHTML. The framework ignores it entirely. It's a naming convention so developers have a consistent place to store custom state, and so code readers know what they're looking at. You are responsible for managing this state yourself.

```javascript
class Accordion extends Jqhtml_Component {
  on_create() {
    this.state = {
      expanded: false,
      animation_duration: 300
    };
  }

  on_ready() {
    this.$sid('toggle').on('click', () => {
      this.state.expanded = !this.state.expanded;

      if (this.state.expanded) {
        this.$sid('content').slideDown(this.state.animation_duration);
      } else {
        this.$sid('content').slideUp(this.state.animation_duration);
      }
    });
  }
}
```

**Key rules:**
- Just a convention (JQHTML ignores it)
- Mutable anywhere
- Not cached
- No automatic re-renders
- Use for timers, flags, WebSocket connections

### Deriving this.state from this.data

For widgets that need to manipulate loaded data in memory without triggering reloads or re-renders (drag-and-drop reordering, optimistic local edits), clone `this.data` into `this.state` in `on_loaded()` — it runs once, right after `on_load()` completes, while `this.data` is still frozen but `this.$`/`this.state` are already accessible:

```javascript
class TodoBoard extends Jqhtml_Component {
  async on_load() {
    this.data.todos = await fetch('/api/todos').then(r => r.json());
  }

  on_loaded() {
    this.state.todos = [...this.data.todos];  // Clone for local manipulation
  }
}
```

See [Lifecycle](../06-lifecycle/#5-on_loaded) for the full `on_loaded()` hook.

## When to Use Each

### Use this.data for:
- Data fetched from APIs
- Content that should be cached
- Data changes that should trigger re-renders

### Use this.args for:
- Configuration that affects what data loads
- Pagination: `this.args.page`
- Filtering: `this.args.filter`
- Sorting: `this.args.sort_by`
- **Then call `reload()`** to re-fetch with new args

### Use this.state for:
- Pure UI state (expanded/collapsed, hover, focus)
- Timers and intervals
- WebSocket connections
- Counters and flags that don't need caching
- **You manage it yourself** - no automatic re-renders or reloads

## Combined Example

```javascript
class ProductGrid extends Jqhtml_Component {
  on_create() {
    // API data defaults
    this.data.products = [];
    this.data.loaded = false;

    // Local UI state
    this.state = {
      selected_ids: new Set(),
      view_mode: 'grid'
    };
  }

  async on_load() {
    // Fetch based on args
    this.data.products = await fetch(
      `/api/products?filter=${this.args.filter}&page=${this.args.page}`
    ).then(r => r.json());
    this.data.loaded = true;
  }

  on_ready() {
    // Filter change - modify args, reload
    this.$sid('filter').on('change', async (e) => {
      this.args.filter = e.target.value;
      await this.reload();
    });

    // View toggle - modify state, update UI
    this.$sid('view_toggle').on('click', () => {
      this.state.view_mode = this.state.view_mode === 'grid' ? 'list' : 'grid';
      this.$.toggleClass('list-view', this.state.view_mode === 'list');
    });

    // Selection - modify state
    this.$.on('click', '.product', (e) => {
      const id = $(e.target).data('id');
      if (this.state.selected_ids.has(id)) {
        this.state.selected_ids.delete(id);
      } else {
        this.state.selected_ids.add(id);
      }
      $(e.target).toggleClass('selected');
    });
  }
}
```

## DOM Is State

For simple cases, the DOM itself can be the state:

```javascript
class Counter extends Jqhtml_Component {
  on_ready() {
    this.$sid('increment').on('click', () => {
      const current = parseInt(this.$sid('count').text());
      this.$sid('count').text(current + 1);
    });
  }
}
```

No separate state object needed. The DOM element holds the value.

## Re-fetching Data

Three methods for getting fresh data, each with different behavior:

| Method | What it does | Use when |
|--------|-------------|----------|
| `load()` | Re-fetches data only, returns `true`/`false` | You want fresh data but control what happens next |
| `reload()` | Re-fetches data AND re-renders | Standard "refresh everything" |
| `refresh()` | Re-fetches data, only re-renders if changed | Polling / background sync |

```javascript
on_ready() {
  // After saving, re-fetch data without automatic re-render
  this.$sid('save').on('click', async () => {
    await fetch('/api/save', { method: 'POST', body: JSON.stringify(this.state.form) });
    const changed = await this.load();
    if (changed) this.render('details');  // Only update specific section
  });

  // Change filter and fully reload
  this.$sid('filter').on('change', async (e) => {
    this.args.filter = e.target.value;
    await this.reload();
  });
}
```

## Quick Reference

| Question | Answer |
|----------|--------|
| Comes from API? | `this.data` |
| Configures what to fetch? | `this.args` |
| Pure UI state? | `this.state` or DOM |
| Should trigger re-render? | `this.data` |
| Should trigger reload? | `this.args` + `reload()` |
| Just want fresh data? | `await this.load()` |
| Timer/WebSocket reference? | `this.state` |

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/reference/14_lifecycle_complete_specification.md` - State properties and decision tree
- `docs/reference/15_deduplication_and_caching.md` - How args/data affect caching

### Last Updated
2026-07-21

### Editorial Notes
- Focused on the practical "which to use" decision
- Combined example shows all three working together
- "DOM is state" included as simple alternative for basic cases
- Freeze/unfreeze behavior mentioned briefly - detail is too internal
- Caching implications mentioned but not detailed (has own chapter)
- Omitted the verbose decision tree from official docs - table is clearer
- Added re-fetching data section with load/reload/refresh comparison
- 2026-07-21: Added "Deriving this.state from this.data" note under this.state, showing on_loaded() as the recommended place to clone this.data into this.state, cross-referenced to chapter 06. Also normalized JqhtmlComponent → Jqhtml_Component to match the actual runtime export.
