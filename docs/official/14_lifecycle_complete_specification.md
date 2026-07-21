# Complete Component Lifecycle Specification

## Overview

JQHTML components follow a **5-stage lifecycle**: **create → render → on_render → load → ready**. This lifecycle is deterministic, depth-ordered, and designed for optimal performance with dynamic data loading.

**Critical**: Understanding the double-render pattern and parent-child coordination is essential for proper component development.

---

## The Five Lifecycle Stages

### 1. create - Quick Setup (Synchronous)

**Purpose**: Immediate synchronous initialization BEFORE first render

**Execution**: Called once before component renders

**Method**: `on_create()`

**Use for**:
- Setting initial properties
- Initializing instance variables
- Quick synchronous setup
- Configuration based on `this.args`

**Rules**:
- **MUST be synchronous** - No async/await
- No DOM modifications (component not in DOM yet)
- No data loading
- No external API calls
- Called BEFORE template execution

```javascript
class UserCard extends Jqhtml_Component {
  on_create() {
    // ✅ Set properties before render
    this.is_expanded = false;
    this.max_items = this.args.max || 10;
    this.theme = this.args.theme || 'light';

    // ❌ FORBIDDEN - No async operations
    // await fetch('/api/data');  // WRONG

    // ❌ FORBIDDEN - No DOM manipulation (not rendered yet)
    // this.$sid('title').text('Hello');  // WRONG
  }
}
```

**Why this runs first**: Allows setup before template execution, so you can initialize flags/properties that the template can reference.

---

### 2. render - Create DOM Structure (Top-Down)

**Purpose**: Execute template and generate HTML structure

**Execution**: Top-down (parent renders before children)

**What happens**:
- Template function executes
- DOM elements created
- Component structure built
- **First render has empty `this.data = {}`**

**Not overridable**: Handled automatically by template system.

```jqhtml
<Define:UserCard>
  <div class="card">
    <% if (Object.keys(this.data).length === 0) { %>
      <div class="loading-spinner">Loading...</div>
    <% } else { %>
      <h3><%= this.data.name %></h3>
      <p><%= this.data.email %></p>
    <% } %>
  </div>
</Define:UserCard>
```

**Key concept**: Templates can check `Object.keys(this.data).length === 0` to detect if data is loaded yet.

---

### 3. on_render() - Post-Render Initialization (Top-Down)

**Purpose**: Immediate DOM initialization right after render, before uninitialized elements are visible

**Execution**: Top-down, immediately after each render

**Method**: `on_render()`

**Use for**:
- Hiding uninitialized DOM elements
- Setting default visual states
- Preparing UI before child components load
- Avoiding flash of uninitialized content

**Critical timing**: Fires BEFORE `on_ready()`, doesn't wait for child components

```javascript
class ProductGrid extends Jqhtml_Component {
  on_render() {
    // Hide grid until all products load and render
    this.$.css('opacity', '0');

    // Set loading state immediately
    this.$sid('status').text('Loading products...');

    // This runs BEFORE child ProductCard components are ready
    // Prevents seeing uninitialized product cards
  }

  on_ready() {
    // NOW all children are ready, show the grid
    this.$.animate({opacity: 1}, 300);
    this.$sid('status').text('');
  }
}
```

**Why this exists**:
- `on_ready()` waits for ALL child components to complete their lifecycle
- If children load data, this can take seconds
- `on_render()` lets you handle uninitialized DOM immediately
- Prevents visual glitches during child component initialization

---

### 4. load - Fetch Data (Bottom-Up, Siblings Parallel)

**Purpose**: Load asynchronous data needed by the component

**Execution**: Bottom-up, siblings in parallel within each depth level

**Method**: `async on_load()`

**Use for**:
- Fetching data from APIs
- Loading external resources
- Async operations
- **ONLY place to populate this.data**

**Rules**:
- Can be async
- **CRITICAL: NO DOM MODIFICATIONS**
- Siblings process in parallel
- Depth levels process sequentially (bottom-up)
- **ONLY modify `this.data`**

```javascript
class UserCard extends Jqhtml_Component {
  async on_load() {
    // ✅ Load data
    this.data = await fetch(`/api/users/${this.args.user_id}`)
      .then(r => r.json());

    // ✅ Load additional resources
    this.data.avatar = await this.load_avatar(this.data.avatar_url);

    // ❌ FORBIDDEN - No DOM manipulation
    // this.$sid('title').text(this.data.name);  // WRONG
    // this.$.addClass('loaded');               // WRONG

    // ❌ FORBIDDEN - No child component access
    // this.$sid('child').component().update();  // WRONG
  }
}
```

**Why no DOM modifications**: Components at the same depth level run `on_load()` in parallel. DOM state is unpredictable during parallel execution.

---

### 4a. Load Gates - `gate_load(promise)`

**Purpose**: Defer a component's **first** `on_load()` until one or more caller-supplied promises settle. Use when a component's initial fetch must not begin until some async precondition is in place (for example, a framework layered on jqhtml confirming a server-side subscription before the first fetch, so the fetch observes state no older than that precondition).

**Method**: `gate_load(promise: Promise<any>): void`

**When to call**: During `on_create()` (any time before the first load phase begins). Calling it after the first load has started **throws**:

```
gate_load() may only be called before the component's first load -
register gates in on_create()
```

```javascript
class Subscribed_Feed extends Jqhtml_Component {
  on_create() {
    this.data.items = [];
    // Do not fetch until the realtime subscription is confirmed.
    // Timeout policy is the caller's responsibility — bake it into the promise.
    this.gate_load(realtime.subscribe(this.args.channel));
  }

  async on_load() {
    // Guaranteed to run only after the gate above settles.
    this.data.items = await fetch(`/api/feed/${this.args.channel}`).then(r => r.json());
  }
}
```

**Semantics**:

- **Accumulate**: Multiple `gate_load()` calls register multiple gates. All are awaited together via `Promise.allSettled()`.
- **Rejections never block**: A rejected gate does **not** abort or delay the load — the load proceeds after settlement. Rejections are logged through the debug channel (they are ordering hints, not data dependencies).
- **One-shot**: Gates apply to the **first** `on_load()` only. Once that load begins the gate list is cleared; `reload()` and `refresh()` never re-await gates.
- **Delays only the load phase**: Gates never delay `create()`, the initial render, `on_render()`, or (in cache modes) the cached-content first paint. Stale-while-revalidate is preserved — the cached paint happens immediately; only the revalidating fetch waits.
- **No custom `on_load()`**: Components without a custom `on_load()` have nothing to gate. Gates are ignored — no throw, no delay.
- **SSR**: A no-op during SSR (the server cannot await arbitrary client promises); the load proceeds immediately.
- **jqhtml stays agnostic**: The framework has no knowledge of *what* is being awaited. The caller supplies the promise and owns all policy (timeouts, retries, etc.).

**Resume triggers (whichever comes first)**: While a component is gated (its first `on_load` paused), the wait is released by whichever of the following happens first — the rest become no-ops:

| Trigger | Effect |
|---------|--------|
| All gates settle | Lifecycle resumes into `on_load` normally. |
| `reload()` called | **Resumes** the paused lifecycle instead of its normal debounced re-fetch. The boot lifecycle runs `on_load` (the fresh fetch) exactly as `reload()` would want. A later gate settlement does nothing. |
| `refresh()` called | Same as `reload()` — resumes the lifecycle. |
| `stop()` called | The load is abandoned cleanly (the existing `_stopped` guards apply); a later gate settlement does nothing. |

**Ready chain**: A gated child naturally delays its own `on_load`, and therefore the bottom-up `on_ready` chain, exactly as any slow `on_load` would. This is intended — no special handling.

**Implementation**: The await lives at the boot seam in `lifecycle-manager.ts`, immediately before the first `on_load` is executed. Storage is a private gate array plus a "first load started" latch on the component (`component.ts`: `gate_load()`, `_await_load_gates()`).

---

### 4b. on_loaded() - Post-Load Processing

**Purpose**: Process loaded data immediately after `on_load()` completes, before re-render or ready phase. Runs on the **real component** (not detached proxy), with full access to `this.$`, `this.state`, and `this.args`.

**Execution**: Called after every `on_load()` completion - during boot, `load()`, `reload()`, and `refresh()`.

**Method**: `on_loaded()`

**Use for**:
- Cloning `this.data` to `this.state` for widgets with complex in-memory data manipulations
- Setting up derived state from loaded data without triggering re-renders
- Firing events after a reload that can mutate things other than `this.data`

**Rules**:
- Can be async
- `this.data` is **FROZEN** (read-only) - cannot modify
- `this.$` is accessible (real component, not proxy)
- `this.state` is writable
- `this.args` is readable
- `this.trigger('loaded')` fires automatically after the method completes

```javascript
class DataGridWidget extends Jqhtml_Component {
  on_create() {
    this.data.rows = [];
    this.state.working_rows = [];  // In-memory working copy
    this.state.sort_order = 'asc';
  }

  async on_load() {
    this.data.rows = await fetch('/api/rows').then(r => r.json());
  }

  on_loaded() {
    // Clone loaded data to state for in-memory sorting/filtering
    // without triggering re-renders or re-fetches
    this.state.working_rows = structuredClone(this.data.rows);
    this.state.working_rows.sort((a, b) =>
      this.state.sort_order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    );
  }

  on_ready() {
    this.$sid('sort_btn').on('click', () => {
      this.state.sort_order = this.state.sort_order === 'asc' ? 'desc' : 'asc';
      // Re-sort working copy without re-fetching
      this.state.working_rows.reverse();
      this.render();
    });
  }
}
```

**Key difference from `on_ready()`**: `on_loaded()` fires before re-render and before children are ready. It's specifically for data post-processing, not DOM manipulation. Use `on_ready()` for DOM work.

---

### 5. ready - Fully Initialized (Bottom-Up)

**Purpose**: Component is fully initialized and ready for interaction

**Execution**: Bottom-up (children ready before parents)

**Method**: `on_ready()`

**Use for**:
- Attaching event handlers
- DOM manipulation
- Interacting with child components
- Initializing third-party plugins
- Hooking into child component events

**Rules**:
- Can be async
- Safe to manipulate DOM
- All data is loaded
- **All children are ready** (guaranteed)

```javascript
class FormComponent extends Jqhtml_Component {
  on_ready() {
    // ✅ All child inputs are ready, hook into their change events
    this.$.find('.InputComponent').each((i, el) => {
      const input = $(el).component();
      input.on('change', () => {
        this.handle_form_change();
      });
    });

    // ✅ Attach event handlers
    this.$sid('submit').on('click', () => {
      this.handle_submit();
    });

    // ✅ DOM manipulation
    if (this.data.is_admin) {
      this.$sid('admin_section').show();
    }
  }

  handle_form_change() {
    // Submit data to server whenever any child changes
    const form_data = this.collect_all_inputs();
    this.save_to_server(form_data);
  }
}
```

**Why bottom-up**: Parents need to access fully-initialized children. By the time parent's `on_ready()` runs, all children are completely ready for interaction.

---

### Lifecycle Truncation Flags

JQHTML provides two flags that truncate the lifecycle for preloading scenarios. These are useful when instantiating components in a detached DOM to warm the data cache, without firing DOM-interaction hooks.

Both flags use the `_` prefix to signal they are internal/framework args. They are excluded from cache key generation.

#### `_load_only`

Executes only `on_create()` and `on_load()`. No render, no children, no DOM hooks.

**Phases that execute:**
1. Constructor
2. `on_create()` — synchronous, set defaults
3. `on_load()` — async, fetch data
4. `trigger('ready')` — lifecycle complete

**Phases skipped:**
- `_render()` — no DOM created, no children instantiated
- `on_render()` — never called
- `on_loaded()` — never called
- `on_ready()` — never called
- `_wait_for_children_ready()` — skipped (no children exist)

**Use case:** Warm the data cache for a single component without creating its child tree.

```javascript
// Preload a component's data
$('<div>').component('Product_List', { category: 'electronics', _load_only: true });
// Product_List.on_load() fires, populates cache. No DOM created.
```

#### `_load_render_only`

Executes `on_create()`, render (creates children), `on_load()`, and re-render. Skips all DOM-interaction hooks.

**Phases that execute:**
1. Constructor
2. `on_create()` — synchronous, set defaults
3. `_render()` — creates DOM and child components (but `on_render()` suppressed)
4. `on_load()` — async, fetch data
5. `_render()` — re-render if data changed (but `on_render()` suppressed)
6. `trigger('ready')` — lifecycle complete

**Phases skipped:**
- `on_render()` — never called (neither first nor second render)
- `on_loaded()` — never called
- `on_ready()` — never called
- `_wait_for_children_ready()` — skipped

**Use case:** Warm the data cache for an entire component tree. Children are created so their `on_load()` methods fire too, populating cache entries for the full page.

```javascript
// Preload an entire SPA route's component tree
$('<div>').component('Dashboard_Page', { user_id: 123, _load_render_only: true });
// Dashboard_Page and ALL its children fire on_load(). No DOM hooks fire.
// When user navigates to dashboard, cached data makes it instant.
```

#### Flag Cascading

Both flags automatically cascade from parent to children during template rendering:

- Parent has flag set AND child doesn't explicitly set it → flag propagates to child
- A child can override by explicitly passing the flag (e.g., `$_load_render_only=false`)

#### Events Fired

| Event | `_load_only` | `_load_render_only` | Normal |
|-------|-------------|---------------------|--------|
| `create` | fires | fires | fires |
| `render` | skipped | fires | fires |
| `loaded` | skipped | skipped | fires |
| `rendered` | skipped | skipped | fires |
| `ready` | fires | fires | fires |

### Detached Element Optimization

When a component's root element is **not in the DOM** at boot time (e.g., `$('<div>').component('My_Component', {})`), the framework detects this via `element.isConnected` during `create()` and applies the following optimizations:

**What changes:**

1. **Initial render is skipped** — No DOM is generated before `on_load()`. The component doesn't render a loading spinner into a detached div nobody can see.
2. **Cache read is skipped** — No point hydrating from localStorage cache when the element isn't visible.
3. **Post-load render is forced** — After `on_load()` completes (or would have completed for static components), the component always renders, regardless of whether `this.data` changed. This is the component's only render.

**Net effect:** Detached components render **once** with final data, instead of the normal double-render (empty → loaded). This is purely a performance optimization — the component reaches the same final state.

**Detection:** The `_is_detached` flag is set during `create()` and is immutable after that. If you append the element to the DOM mid-load (while `on_load()` is still running), the flag remains `true` — the component still renders once after load, but now the rendered content is visible in the DOM because the element was appended.

**Static components (no `on_load()`):** These complete their entire lifecycle synchronously. For detached static components, the initial render skip + forced post-load render still results in exactly one render, but it happens synchronously during boot rather than after an async yield.

#### `_force_initial_render`

Override the detached optimization when you need the normal double-render behavior on a detached element. Use case: you want the loading spinner visible immediately when you append the element to the DOM, before `on_load()` completes.

```javascript
const $card = $('<div>').component('User_Card', { _force_initial_render: true });
$('#container').append($card);
// Loading spinner is visible immediately — on_load() revalidates in background
```

Without this flag, appending a detached component before `on_load()` completes shows an empty div until the post-load render fires.

**This flag does not cascade to children.** It is a per-component opt-in.

#### Implementation Details

- **Flag location:** `_is_detached` property on `Jqhtml_Component`, set in `create()` via `!this.$[0].isConnected && !this._force_initial_render`
- **Lifecycle manager:** `boot_component()` in `lifecycle-manager.ts` treats detached the same as `_load_only` for initial render (sets `render_id = 0`, `_render_count = 0`), then forces render after load via `is_detached || _should_rerender()`
- **Cache skip:** `read_cache_in_create()` is guarded by `!this._is_detached` in `component.ts create()`
- **Data snapshot:** Still taken during `create()` regardless of detached state — `on_load()` needs the restore point

---

## The Double-Render Pattern

**Critical behavior**: Components may render TWICE during initialization.

### First Render (Initial)
- `this.data = {}` (empty)
- Template renders with no data
- `on_render()` fires
- Template can show loading spinner

### on_load() Executes
- Fetches data
- Populates `this.data`

### Automatic Re-render Check
**If `this.data` changed during `on_load()`**:
1. DOM is emptied
2. Component re-renders with populated `this.data`
3. `on_render()` fires again
4. Child components re-initialized (if any)
5. Waits for all children to become ready
6. `on_ready()` fires

**If `this.data` unchanged**: Skip re-render, proceed to `on_ready()`

**Animation suppression**: While this re-render happens, the framework automatically adds a `__jqhtml_disable_animations` class to the component's root element, which disables CSS `animation`/`transition` on it and all descendants (`animation: none !important; transition: none !important;`). This prevents freshly-rendered elements from visually "animating in" as an artifact of the DOM swap. The class is removed on the next animation frame (plus a 5ms buffer) after the browser has painted the new DOM, so any animations you intentionally trigger afterward (e.g. from `on_ready()`) are unaffected. This only applies to the initial-boot double-render (and the equivalent re-render inside `_load_render_only`) — it does not apply to `reload()`/`refresh()`.

### Example: Double Render in Action

```jqhtml
<Define:ProductList>
  <div class="products">
    <% if (Object.keys(this.data).length === 0) { %>
      <!-- FIRST RENDER: Show loading spinner -->
      <div class="loading-spinner">Loading products...</div>
    <% } else { %>
      <!-- SECOND RENDER: Show actual products -->
      <% for (let product of this.data.products) { %>
        <ProductCard $product_id=product.id />
      <% } %>
    <% } %>
  </div>
</Define:ProductList>
```

```javascript
class ProductList extends Jqhtml_Component {
  on_render() {
    // Fires TWICE: once before load, once after load
    console.log('Rendered, data empty?', Object.keys(this.data).length === 0);
  }

  async on_load() {
    // Fetch products
    this.data.products = await fetch('/api/products').then(r => r.json());

    // After this returns, automatic re-render happens
    // because this.data changed from {} to {products: [...]}
  }

  on_ready() {
    // Fires ONCE: after second render, all ProductCard children ready
    console.log('Ready with', this.data.products.length, 'products');
  }
}
```

---

## Lifecycle Flow with Double-Render

```
Component Tree:
  ProductList
    ├─ ProductCard (1)
    ├─ ProductCard (2)
    └─ ProductCard (3)

Execution Order:

1. CREATE (Top → Down) - runs before this component's first render
   ProductList.on_create()

2. RENDER (Top → Down) - FIRST RENDER
   ProductList renders (this.data = {})
   └─ Shows loading spinner

3. ON_RENDER (Top → Down) - FIRST TIME
   ProductList.on_render()
   └─ Hide uninitialized elements

4. LOAD (Bottom → Up, Siblings Parallel)
   ProductList.on_load()
   └─ Fetches products, populates this.data

5. AUTOMATIC RE-RENDER CHECK
   this.data changed? YES
   └─ Trigger re-render

6. RENDER (Top → Down) - SECOND RENDER
   ProductList renders (this.data = {products: [...]})
   For each ProductCard, in document order, CREATE → RENDER → ON_RENDER
   run synchronously nested inside this step (children are created the
   moment the template instantiates them, always before their own render):
   ├─ ProductCard(1): on_create() → renders → on_render()
   ├─ ProductCard(2): on_create() → renders → on_render()
   └─ ProductCard(3): on_create() → renders → on_render()

7. ON_RENDER (Top → Down) - SECOND TIME
   ProductList.on_render()  (runs after all children above have been
   created and rendered)

8. LOAD (Bottom → Up, Siblings Parallel)
   ⚡ ProductCard(1).on_load() ⚡
   ⚡ ProductCard(2).on_load() ⚡  (All 3 run simultaneously)
   ⚡ ProductCard(3).on_load() ⚡

8b. ON_LOADED (Bottom → Up)
    ProductCard(1).on_loaded()  → trigger('loaded')
    ProductCard(2).on_loaded()  → trigger('loaded')
    ProductCard(3).on_loaded()  → trigger('loaded')

9. READY (Bottom → Up)
    ├─ ProductCard(1).on_ready()
    ├─ ProductCard(2).on_ready()
    ├─ ProductCard(3).on_ready()
    └─ ProductList.on_ready()  (NOW all children ready)
```

**Note on CREATE ordering:** `create()` always runs immediately before a component's own first `render()` — it is never "bottom-up" like `load()`/`ready()`. For children, that means CREATE happens in top-down document order as the parent's template instantiates them, nested inside the parent's own RENDER step, and always before that child's RENDER/ON_RENDER.

---

## Microtask Yield Before Ready Phase

After the final render completes (either the first render, or the re-render after `on_load()` data changes), the framework yields execution to the JavaScript microtask queue before proceeding to the ready phase.

### Why This Exists

Child component boots are fired asynchronously ("fire and forget") during the render phase. While parents don't explicitly wait for children to boot before continuing, some async callbacks may be queued in the microtask queue. The yield ensures these pending operations complete before `on_ready()` runs.

### Implementation Details

The yield uses `await Promise.resolve()`, which:

1. **Schedules on the microtask queue** - Not the macrotask queue like `setTimeout(0)`
2. **Does not trigger a paint cycle** - Browser paint only happens after macrotasks
3. **Completes synchronously if nothing queued** - If no microtasks are pending, execution continues immediately with no observable delay
4. **Re-validates state after yield** - The framework re-checks `_stopped` and `_render_count` to ensure the component wasn't stopped or re-rendered during the yield

### When This Matters

This is primarily relevant for:
- Complex component trees where child boots may queue callbacks
- Components that interact with external async APIs during boot
- Edge cases where timing between parent and child lifecycle phases is critical

For most components, this yield is invisible - it completes instantly and has no observable effect. It exists as a safety mechanism to ensure deterministic behavior in edge cases.

### Technical Note

`Promise.resolve()` vs `setTimeout(0)`:
- `Promise.resolve()` → microtask queue → no paint → minimal delay
- `setTimeout(0)` → macrotask queue → may trigger paint → 4ms minimum delay in browsers

The microtask approach ensures the framework doesn't introduce unnecessary visual delays or paint cycles.

---

## Detached on_load() Execution

### Architecture Overview

The `on_load()` method runs on a **fully detached proxy** rather than the component instance itself. This ensures complete isolation during data fetching:

```
on_load() executes on:
┌─────────────────────────────┐
│  Detached Proxy             │
│  ├─ args (read-only ref)    │
│  └─ data (cloned copy)      │
└─────────────────────────────┘
         ↓ after on_load completes
         ↓
┌─────────────────────────────┐
│  Sequential Queue           │
│  ├─ Wait for earlier calls  │
│  └─ Apply result to this.data│
└─────────────────────────────┘
```

### Why Detached Execution?

1. **True Isolation**: `on_load()` cannot accidentally modify the component during execution
2. **Parallel Safety**: Multiple `on_load()` calls can run simultaneously without interference
3. **Race Condition Prevention**: Even if `reload()` is called during initial boot, data updates are serialized

### Sequential Data Application Queue

When `on_load()` completes, its result is applied to `this.data` via a sequential queue. This ensures FIFO ordering even when multiple loads complete out of order:

```
Timeline:
  Call 1 (boot)   starts → on_load takes 100ms
  Call 2 (reload) starts at 50ms → on_load takes 20ms

Execution:
  Call 1: [--------on_load--------]
  Call 2:      [--on_load--]
                           ↓
                   Call 2 finishes first but waits
                           ↓
                                    [Call 1 applies data]
                                    [Call 2 applies data]

Final state: Call 2's data (most recent call wins)
```

### reload() During Initial Boot

A common scenario is calling `reload()` on a component that's still in its initial boot phase (e.g., user triggers a filter change while data is loading). With detached execution:

1. **Both loads run in parallel** - No blocking or errors
2. **First load's data applies first** - Respects call order
3. **Second load's data applies second** - Becomes final state
4. **Component re-renders twice** - Once per data application

This is the correct behavior: the component shows initial data briefly, then updates to reflect the reload.

### Implementation Details

The proxy provides:
- `this.args` - Read-only reference to the real args
- `this.data` - Cloned copy that `on_load()` modifies

After `on_load()` completes:
1. Result data is extracted from the proxy
2. Queue ensures earlier calls apply first
3. `this.data` is briefly unfrozen
4. Result is applied and normalized
5. `this.data` is frozen again
6. Cache is updated if applicable
7. `on_loaded()` is called on the real component (see below)
8. `'loaded'` event is triggered

---

## Parallelization Strategy

### Depth-Ordered Concurrent Execution

**Not "fully parallel"** - siblings run in parallel, depth levels sequential.

```
Component Tree:
     A (depth 0)
    / \
   B   C (depth 1)
  / \   \
 D   E   F (depth 2)

Execution (bottom-up):

Level 2 (deepest):
  ⚡ D.on_load() ⚡
  ⚡ E.on_load() ⚡  (All run simultaneously)
  ⚡ F.on_load() ⚡
  └─ Wait for ALL level 2 to complete

Level 1:
  ⚡ B.on_load() ⚡  (Both run simultaneously)
  ⚡ C.on_load() ⚡
  └─ Wait for ALL level 1 to complete

Level 0:
  A.on_load()
  └─ Done
```

**Why depth-ordered**: Ensures deterministic behavior without mutex-style locking. Parents can safely assume children are complete.

---

## Parent-Child Coordination Pattern

### Form Example

```jqhtml
<Define:UserForm>
  <form>
    <UserSelector $sid="user_selector" />
    <RoleSelector $sid="role_selector" />
    <DatePicker $sid="join_date" />
    <button $sid="submit">Save</button>
  </form>
</Define:UserForm>
```

```javascript
class UserForm extends Jqhtml_Component {
  async on_load() {
    // Parent loads its own data
    this.data.form_config = await fetch('/api/form-config').then(r => r.json());
  }

  on_ready() {
    // By now, ALL child components are ready:
    // - UserSelector has loaded users list
    // - RoleSelector has loaded roles list
    // - DatePicker is initialized

    // Hook into all child change events
    this.$sid('user_selector').component().on('change', () => {
      this.auto_save();
    });

    this.$sid('role_selector').component().on('change', () => {
      this.auto_save();
    });

    this.$sid('join_date').component().on('change', () => {
      this.auto_save();
    });

    // Submit button
    this.$sid('submit').on('click', () => {
      this.submit_form();
    });
  }

  auto_save() {
    // Collect data from all child components
    const data = {
      user: this.$sid('user_selector').component().get_selected(),
      role: this.$sid('role_selector').component().get_selected(),
      join_date: this.$sid('join_date').component().get_value()
    };

    // Auto-save to server
    fetch('/api/save-draft', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  submit_form() {
    // All child components guaranteed ready and accessible
    const form_data = this.collect_all_child_data();
    this.submit_to_server(form_data);
  }
}
```

---

## Lifecycle Manipulation Methods

These methods allow programmatic control of the component lifecycle after initialization.

### render() - Re-render with Full Lifecycle

**Purpose**: Re-renders the component with complete lifecycle execution: updates DOM, waits for children, calls `on_ready()`, and fires ready event.

**Behavior**:
1. Executes `_render()` - Updates DOM, creates child components, calls `on_render()`
2. Waits for all child components to be ready (`_wait_for_children_ready()`)
3. Calls `on_ready()` lifecycle hook
4. Triggers `'ready'` event
5. **Does NOT** call: `on_create`, `on_load`

**Lifecycle sequence**: `_render()` → `_wait_for_children_ready()` → `on_ready()` → `trigger('ready')`

**Async**: This is an async operation. Always use `await` when calling.

**Use when**: You've modified `this.data` programmatically and want a complete re-render with lifecycle hooks.

```javascript
class ProductCard extends Jqhtml_Component {
  async update_price(new_price) {
    this.data.price = new_price;
    await this.render();  // Updates DOM, waits for children, calls on_ready
  }
}
```

**Note**: `redraw()` is an alias for `render()` - both methods do exactly the same thing.

---

### load() - Re-fetch Data Only (No Re-render)

**Purpose**: Re-executes `on_load()` to fetch fresh data and atomically updates `this.data`, calling `on_loaded()` along the way, but does NOT re-render. Returns whether data changed.

**Pattern**: `load()` invokes `on_load()` then `on_loaded()`, just as `render()` invokes `on_render()`. The unprefixed method is what you call; the `on_` method is the hook you override.

**Behavior**:
1. Snapshots current `this.data` for change detection
2. Restores `this.data` to `on_create()` snapshot (deterministic environment)
3. Executes `on_load()` on detached proxy (same restrictions as boot-time)
4. Atomically updates `this.data` with result, re-freezes it
5. Updates cache if data changed
6. Calls `on_loaded()` and triggers the `'loaded'` event
7. Returns `true` if data changed, `false` if unchanged
8. **Does NOT** call: `on_create()`, `on_render()`, `on_ready()`, `render()`
9. **Does NOT** trigger `'render'`, `'rendered'`, or `'ready'` events

**Same restrictions as boot-time `on_load()`**:
- `this.data` is unfrozen (writable)
- `this.args` is read-only
- `this.$`, `this.$sid()`, and all other properties are blocked

**Use when**:
- You've saved something to the backend and want fresh data, but want to control what happens next
- You need to re-fetch before deciding whether to render (check the return value)
- You want to update data for a specific `$redrawable` element without re-rendering the whole component

```javascript
class InvoiceEditor extends Jqhtml_Component {
  async on_load() {
    this.data.invoice = await fetch(`/api/invoices/${this.args.id}`).then(r => r.json());
  }

  on_ready() {
    this.$sid('save_btn').on('click', async () => {
      // Save changes to backend
      await fetch(`/api/invoices/${this.args.id}`, {
        method: 'PUT',
        body: JSON.stringify(this.state.form_data)
      });

      // Re-fetch data without re-rendering
      const changed = await this.load();

      if (changed) {
        this.render('status_badge');  // Only update the status badge
      }
    });
  }
}
```

---

### reload() - Re-fetch Data and Re-render

**Purpose**: Re-runs `on_load()` to fetch fresh data, intelligently re-renders only when needed.

**Debouncing behavior**: `reload()` is automatically debounced to prevent redundant executions:
- Multiple rapid calls to `reload()` are coalesced into a single execution
- If called while `on_load()` is running, additional calls are queued
- Only the most recent call executes if multiple calls are queued
- All callers receive the same promise, resolved when execution completes

**Smart caching behavior**:
- If `this.args` changed since last render: checks cache for new args
- If cache hit with non-empty data: hydrates `this.data` and renders immediately
- Always calls `on_load()` to fetch fresh data and update cache
- Conditionally re-renders: only if didn't render from cache, OR if data changed after `on_load()`

**Behavior**:
1. **Check args change**: Compare current `this.args` with `_args_on_last_render`
2. **Cache check** (if args changed): Try to load cached data for new args → render if cache hit
3. **Call `on_load()`**: Runs `on_load()`, updates `this.data`, writes to cache
4. **Conditional render**: Renders only if needed (didn't render yet OR data changed)
5. **Wait for children**: Waits for all children to be ready (bottom-up ordering)
6. **Call `on_ready()`**: Runs `on_ready()` after children are ready
7. **Does NOT** call: `on_create()`

**Lifecycle sequence**:
1. Args changed? → Read cache → Render if cache hit with non-empty data
2. Restore `this.data` to `on_create()` snapshot, call `on_load()`, update cache
3. Render if (didn't render from cache) OR (data changed after `on_load()`)
4. Wait for all children to be ready
5. Call `on_ready()`

**Use when**:
- Need fresh data from server/source (user triggers "refresh")
- `this.args` changed and you want to reload with new parameters
- Want automatic cache optimization for faster subsequent loads

**Performance**: If args changed and cache exists, first render is instant from cache, then revalidates in background (stale-while-revalidate pattern).

```javascript
class ProductList extends Jqhtml_Component {
  async on_load() {
    this.data.products = await fetch('/api/products').then(r => r.json());
  }

  on_ready() {
    // Simple refresh button
    this.$sid('refresh_btn').on('click', async () => {
      await this.reload();  // Fetches fresh products, updates UI
    });

    // Changing filter and reloading (cache-optimized)
    this.$sid('filter_select').on('change', async (e) => {
      this.args.filter = e.target.value;  // Change args
      await this.reload();  // Checks cache for new filter, then revalidates
    });
  }
}
```

---

### refresh() - Smart Re-fetch (Only Re-render if Data Changed)

**Purpose**: Re-runs `on_load()` to fetch fresh data, but only re-renders if the fetched data actually changed.

**Key difference from `reload()`**:
- `reload()` always re-renders after `on_load()` completes
- `refresh()` compares the fetched data against the last-rendered data snapshot and skips the re-render entirely if nothing changed

**Debouncing behavior**: `refresh()` shares the same debounced queue as `reload()`. If `reload()` is called while a `refresh()` is queued, `reload()` takes precedence and forces a re-render.

**Behavior**:
1. Restores `this.data` to the `on_create()` snapshot
2. Calls `on_load()` to fetch fresh data
3. Compares the fetched data with the last-rendered data snapshot
4. **Only re-renders if the data changed** (unlike `reload()`, which always renders)
5. If no re-render occurs, skips waiting for children and calling `on_ready()`
6. **Does NOT** call: `on_create()`

**Use when**:
- Polling for updates (avoid unnecessary re-renders)
- "Check for updates" buttons
- Background data synchronization
- Any scenario where the data might not have changed since the last fetch

**Performance**: Eliminates unnecessary DOM updates and `on_ready()` calls when the underlying data hasn't changed, reducing CPU usage and preventing visual flicker.

```javascript
class LivePriceTicker extends Jqhtml_Component {
  async on_load() {
    this.data.price = await fetch('/api/price').then(r => r.json());
  }

  on_ready() {
    // Poll for updates every 5 seconds - only re-renders if the price changed
    setInterval(async () => {
      await this.refresh();  // No visual flicker if data unchanged
    }, 5000);

    // Manual "check for updates" button
    this.$sid('check_updates').on('click', async () => {
      await this.refresh();  // Only updates UI if data changed
    });
  }
}
```

---

### stop() - Component Cleanup

**Purpose**: Synchronously stops component and all children before removal.

**Behavior**:
1. Checks if already stopped (`_Component_Stopped` class)
2. Sets `_Component_Stopped` class on element
3. Recursively stops all child components
4. Calls `on_stop()` lifecycle hook
5. Triggers `stop` event
6. **Does NOT** remove DOM (caller is responsible for removal)

**Synchronous**: `stop()`, `on_stop()`, and `this.on('stop')` must all be synchronous. The entire stop process is atomic.

**Use when**:
- Removing component from DOM
- Component is no longer needed
- Need to release resources (timers, listeners, etc.)

**Not guaranteed**: `on_stop()` only runs when component is explicitly stopped via framework methods. It does NOT run if the DOM node is removed without going through the framework (e.g., orphaned nodes, direct jQuery `.remove()` without calling `.component().stop()` first). Do not rely on `on_stop()` for critical cleanup that would cause problems if skipped.

```javascript
class LiveChart extends Jqhtml_Component {
  on_ready() {
    // Start polling timer
    this.poll_timer = setInterval(() => {
      this.fetch_latest_data();
    }, 5000);

    // WebSocket connection
    this.ws = new WebSocket('ws://data-feed.com');
    this.ws.onmessage = (msg) => this.update_chart(msg.data);
  }

  on_stop() {
    // Clean up timer (MUST be synchronous)
    if (this.poll_timer) {
      clearInterval(this.poll_timer);
      this.poll_timer = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Unregister external listeners
    $(window).off('resize', this.handle_resize);
  }
}

// Later, when removing component:
const chart = $('#live-chart').component();
chart.stop();  // Synchronous cleanup
$('#live-chart').remove();  // Now safe to remove DOM
```

---

### ready(callback?) - Wait for Component to Be Ready

**Purpose**: Returns a promise that resolves when the component has completed its full lifecycle and is ready for interaction. Optionally accepts a callback that executes when ready.

**Signature**: `ready(callback?: () => void): Promise<void>`

**Behavior**:
- If component is already ready (`_ready_state >= 4`): Executes callback immediately (if provided) and returns resolved promise
- If component is not ready yet: Returns promise that resolves when `'ready'` event fires, executing callback at the same time

**Use when**:
- Waiting for programmatically created components to initialize before interacting with them
- Waiting for child components to be ready before parent performs operations
- Ensuring component is fully booted before accessing its methods or properties

```javascript
class ParentComponent extends Jqhtml_Component {
  async on_ready() {
    // Create child component programmatically
    this.$sid('container').component('DataGrid', {
      endpoint: '/api/users'
    });

    // Wait for child to be fully ready before interacting
    const grid = this.sid('container');
    await grid.ready();

    // Safe to call methods now - component is fully initialized
    grid.apply_filter('active');
  }
}
```

**Example - Component replacement:**

```javascript
class Dashboard extends Jqhtml_Component {
  async on_ready() {
    // Replace component and wait for new one to be ready
    this.$sid('view').component('GridView', {items: this.data.items});
    await this.sid('view').ready();

    // New component is ready - safe to interact
    this.sid('view').set_sort_order('asc');
  }
}
```

**Example - External code waiting for component:**

```javascript
// Create component
$('#app').component('Application', {user_id: 123});

// Wait for it to be fully initialized
const app = $('#app').component();
await app.ready();

// Component is ready - safe to call methods
app.load_dashboard();
```

**Example - Callback pattern:**

```javascript
// Using callback instead of await
const grid = this.sid('data_grid');
grid.ready(() => {
  console.log('Grid is ready!');
  grid.apply_filter('active');
});

// Or combine both patterns
await grid.ready(() => console.log('Callback fires at same time as promise resolves'));
```

**Note**: This is the **public API** for waiting on components. The internal `_ready()` method is used by the framework for lifecycle orchestration.

---

### rendered(callback?) - Wait for Render Chain to Complete

**Purpose**: Returns a promise that resolves when the component has completed its synchronous render chain, but BEFORE the async ready phase begins.

**Signature**: `rendered(callback?: () => void): Promise<void>`

**When it fires**: After the final `on_render()` completes (either from the first render, or after re-render triggered by `on_load()` data changes). This is the earliest point where:
- The component has loaded its data (if it has an `on_load()`)
- The component has rendered its final DOM structure
- All child components have been instantiated and have completed their first render
- But we are NOT waiting for child components to complete their async load/ready phases

**Fires exactly once**: The `'rendered'` event fires once per component lifecycle. Subsequent calls to `rendered()` resolve immediately.

**Use case**: This is a niche API for scenarios where you need to know a component's DOM is stable without waiting for all descendants to fully load. The primary use case is SPA (Single Page Application) layouts:

```javascript
// SPA Layout Example
// Wait for layout to render so we can set navigation state,
// without waiting for the page content component to fully load its data

class App_Layout extends Jqhtml_Component {
  async on_load() {
    this.data.current_page = this.args.page;
  }

  on_ready() {
    // When navigating, we want to update nav links immediately
    // without waiting for the page content to fully load
    this.update_active_nav();
  }
}

// In router/navigation code:
async function navigate_to(page_name) {
  // Create or update the layout
  const layout = $('#app').component();
  layout.args.page = page_name;

  // Wait for layout to render (nav links exist, page container exists)
  // but don't wait for the page content component to load its data
  await layout.rendered();

  // NOW we can safely update which nav link is "active"
  // even though the page content is still loading
  layout.update_active_nav();
}
```

**Comparison with `ready()`**:
- `ready()` waits for the component AND all descendants to complete their full lifecycle (including async `on_load()` and `on_ready()`)
- `rendered()` resolves earlier - after the render chain completes but before waiting on children's async phases

**When to use `rendered()` vs `ready()`**:
- Use `ready()` for 99% of cases - when you need the component fully initialized
- Use `rendered()` only when you specifically need early access to a component's DOM before its dynamic children have loaded their data

---

### Invocation / Hook Pattern

Developer-callable methods invoke their corresponding `on_` hooks:

| You call | Framework executes | Purpose |
|----------|-------------------|---------|
| `render()` | `on_render()` | Re-render DOM with current data |
| `load()` | `on_load()` → `on_loaded()` | Re-fetch data only |
| `reload()` | `on_load()` → `on_loaded()` + `render()` | Re-fetch AND re-render |
| `refresh()` | `on_load()` → `on_loaded()` + `render()` (only if data changed) | Re-fetch, skip render if unchanged |

### Method Comparison

| Function | Calls `on_load()` | Calls `on_loaded()` | Calls `on_create()` | Calls `on_ready()` | Redraws DOM | Use Case |
|----------|-------------------|----------------------|---------------------|-------------------|-------------|----------|
| `load()` | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | Re-fetch data only (developer controls next step) |
| `render()` | ❌ No | ❌ No | ❌ No | ✅ Yes | ✅ Yes | Re-render with full lifecycle |
| `reload()` | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes | Need fresh data from source |
| `refresh()` | ✅ Yes | ✅ Yes | ❌ No | Conditional* | Conditional* | Re-fetch, skip render if data unchanged |
| `stop()` | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | Stop lifecycle before removal |
| `ready()` | ❌ No | ❌ No | ❌ No | ❌ No | Wait for full lifecycle completion |
| `rendered()` | ❌ No | ❌ No | ❌ No | ❌ No | Wait for render chain only (before ready) |

**Note:** `redraw()` is an alias for `render()`

**\*`refresh()` calls `on_ready()`/redraws DOM conditionally:** Only if the data changed after `on_load()` compared to the last-rendered data. If no render occurs, `on_ready()` is NOT called.

---

## Component State Management

JQHTML provides three properties (`this.args`, `this.data`, `this.state`) with specific behaviors. Understanding these behaviors helps you write components that benefit from framework features like caching.

### What the Framework Actually Does

**`on_load()` always runs** - even if you don't define one, the empty default runs. After it completes, `this.data` is frozen.

**`this.args` is special because:**
1. It's the input to `on_load()` - your data-fetching logic reads from it
2. It determines the cache key (component name + `this.args`)
3. Changing `this.args` and calling `reload()` may return cached data instantly

**`this.data` is special because:**
1. It's frozen outside `on_create()` and `on_load()` - modifications elsewhere throw errors
2. Changes to it trigger automatic re-renders
3. It's cached by the framework

**`this.state` and custom properties** have no special framework behavior - they're just JavaScript properties you can use however you want.

### Why Follow the Conventions?

The conventions exist for **caching benefits**, not arbitrary rules:

**Using `on_load()` properly** enables the framework to cache data. When a user navigates back to a page, cached data renders instantly while fresh data loads in the background. Without `on_load()`, you'll always see loading artifacts.

**The recommended pattern:**
1. Event fires (click, change)
2. Update `this.args` with new parameters
3. Call `this.reload()`
4. `on_load()` reads `this.args`, fetches data, populates `this.data`
5. Template re-renders with new `this.data`

**Example:**
```javascript
class ProductList extends Jqhtml_Component {
  async on_load() {
    // Read from this.args, populate this.data
    this.data.products = await fetch(`/api/products?filter=${this.args.filter}`)
      .then(r => r.json());
  }

  on_ready() {
    this.$sid('filter').on('change', async (e) => {
      this.args.filter = e.target.value;
      await this.reload();  // May return cached data instantly!
    });
  }
}
```

### Simple Components Without Data Loading

If your component doesn't fetch data, you have flexibility. Templates can read from `this.args`, `this.state`, or any property:

```javascript
class SimpleCounter extends Jqhtml_Component {
  on_create() {
    this.args.count = this.args.count || 0;
  }

  on_ready() {
    this.$sid('increment').on('click', () => {
      this.args.count++;
      this.render();  // Template reads this.args.count directly
    });
  }
}
```

This works fine—since there's no data loading, the component renders instantly and there's nothing to cache anyway.

### Principle of Least Surprise

Following conventions makes code predictable to other developers:

| Property | Convention | Why |
|----------|------------|-----|
| `this.args` | Parameters that affect data loading | Input to `on_load()`, determines cache key |
| `this.data` | Data from APIs | Populated in `on_load()`, enables caching |
| `this.state` | Internal UI state | No framework meaning, just convention |

**Why it matters:** When someone reads `this.args.filter`, they know it affects data loading. When they see `this.state.is_expanded`, they know it's UI state. Consistent patterns reduce cognitive load.

---

### The Three State Properties

#### `this.args` - Component Configuration

**Purpose**: Component parameters that control what data to fetch and how the component behaves.

**Set via**: `$attribute` syntax in template invocations
```jqhtml
<UserCard $user_id=123 $theme="dark" />
```

**Characteristics**:
- Read by `on_load()` to determine what data to fetch (e.g., `this.args.user_id`, `this.args.filter`)
- Mutable in `on_create()`, `on_ready()`, and other lifecycle methods
- **Read-only in `on_load()`** - attempting to modify throws error
- When changing `this.args`, call `this.reload()` to re-fetch data with new parameters

**Common use cases**:
- Filter values: `this.args.filter = 'active'`
- Pagination: `this.args.page = 2`
- Sort order: `this.args.sort_by = 'name'`
- Resource IDs: `this.args.user_id = 456`

```javascript
class ProductList extends Jqhtml_Component {
  on_create() {
    // Set default args if not provided
    this.args.filter = this.args.filter || 'all';
    this.args.page = this.args.page || 1;
  }

  async on_load() {
    // Read args to determine what to fetch
    this.data.products = await fetch(
      `/api/products?filter=${this.args.filter}&page=${this.args.page}`
    ).then(r => r.json());
  }

  on_ready() {
    // Change args and reload
    this.$sid('filter_select').on('change', async (e) => {
      this.args.filter = e.target.value;  // Update configuration
      await this.reload();                 // Re-fetch with new filter
    });

    this.$sid('next_page').on('click', async () => {
      this.args.page++;                    // Update page number
      await this.reload();                 // Fetch next page
    });
  }
}
```

---

#### `this.data` - Dynamic Data from APIs

**Purpose**: Data loaded from AJAX/APIs. **ONLY use for data fetched via `on_load()`**.

**Characteristics**:
- Set initial defaults in `on_create()` (e.g., `this.data.loaded = false`)
- Populated from API responses in `on_load()` (e.g., `this.data = await fetch(...)`)
- **Freeze/unfreeze cycle** enforced via Proxy:
  - **Frozen** after `on_create()` completes
  - **Unfrozen** during `on_load()` execution
  - **Restored** to `on_create()` state before each `on_load()` call
  - **Frozen** again after `on_load()` completes
- **Access restrictions in `on_load()`**: Can ONLY access `this.args` (read-only) and `this.data` (read/write)
- Framework automatically caches `this.data` based on component name + `this.args`
- Modifications trigger automatic re-renders

**Why the freeze/unfreeze cycle exists**:
- Ensures data modifications happen in controlled lifecycle phases
- Triggers proper re-renders when data changes
- Enables automatic caching and stale-while-revalidate pattern
- Prevents accidental state mutations that bypass framework

**Common use cases**:
- User profiles: `this.data.user = {...}`
- Product lists: `this.data.products = [...]`
- Form data: `this.data.form_values = {...}`
- Loading flags: `this.data.loaded = true`

```javascript
class UserProfile extends Jqhtml_Component {
  on_create() {
    // Set initial data defaults (data is unfrozen)
    this.data.loaded = false;
    this.data.user = null;
    // After on_create(), this.data becomes FROZEN
  }

  async on_load() {
    // this.data is UNFROZEN at start of on_load()
    // this.data has been RESTORED to on_create() state

    // Fetch data from API
    this.data.user = await fetch(`/api/users/${this.args.user_id}`)
      .then(r => r.json());
    this.data.loaded = true;

    // After on_load(), this.data becomes FROZEN again
    // Framework automatically re-renders because this.data changed
  }

  on_ready() {
    // this.data is FROZEN - attempting to modify throws error
    // ❌ this.data.count++; // ERROR: Cannot modify frozen this.data

    // Use data to manipulate DOM
    this.$sid('name').text(this.data.user.name);
    this.$sid('email').text(this.data.user.email);
  }
}
```

**Enforcement**: Attempting to modify `this.data` outside `on_create()` or `on_load()` throws detailed error:

```javascript
on_ready() {
  this.data.count++;  // ❌ ERROR
}

// Console output:
// [JQHTML] ERROR: Component "MyComponent" attempted to modify this.data.count outside of on_create() or on_load().
//
// RESTRICTION: this.data can ONLY be modified in:
//   - on_create() (set initial defaults, synchronous only)
//   - on_load() (fetch data from APIs, can be async)
//
// WHY: this.data represents loaded state. Modifying it outside these methods bypasses the framework's render cycle.
//
// FIX: Modify this.data in on_create() (for defaults) or on_load() (for fetched data):
//   ❌ In on_ready(): this.data.count = 5;
//   ✅ In on_create(): this.data.count = 0; // Set default
//   ✅ In on_load(): this.data.count = await fetch(...); // Fetch from API
//   ✅ For component state: this.args.count = 5; (accessible in on_load)
```

---

#### `this.state` - Arbitrary Component State (Convention)

**Purpose**: Manual state management for components that don't load data via APIs, or for complex setups that bypass `on_load()`.

**Characteristics**:
- **Has no special meaning to JQHTML** - just a convention for programmer convenience
- Mutable anywhere in component lifecycle (no restrictions)
- Not cached by framework
- Not frozen (no Proxy enforcement)
- Modifications don't trigger automatic re-renders
- Store arbitrary properties: flags, timers, intervals, counters, etc.

**When to use `this.state`**:
1. Component has NO dynamic data loads from APIs
2. Component loads data outside of `on_load()` for complex scenarios
3. Need to store internal component state that shouldn't trigger re-renders
4. Timers, intervals, WebSocket connections, event handlers

**Common use cases**:
- Timers: `this.state.timer = setInterval(...)`
- Counters: `this.state.click_count = 0`
- Flags: `this.state.is_expanded = true`
- References: `this.state.ws = new WebSocket(...)`
- Caches: `this.state.cached_results = {...}`

```javascript
class LiveCounter extends Jqhtml_Component {
  on_create() {
    // Initialize state (no API data to load)
    this.state = {
      counter: 0,
      timer: null,
      is_paused: false
    };
  }

  on_ready() {
    // Start timer
    this.state.timer = setInterval(() => {
      if (!this.state.is_paused) {
        this.state.counter++;
        this.$sid('count').text(this.state.counter);
      }
    }, 1000);

    // Pause/resume button
    this.$sid('pause').on('click', () => {
      this.state.is_paused = !this.state.is_paused;
      this.$sid('pause').text(this.state.is_paused ? 'Resume' : 'Pause');
    });
  }

  on_stop() {
    // Clean up timer
    if (this.state.timer) {
      clearInterval(this.state.timer);
      this.state.timer = null;
    }
  }
}
```

---

### Decision Tree: Which Property to Use?

**Use this 5-question decision tree to determine the correct property for your component:**

#### Question 1: Does your component need to load data from an API or async source in `on_load()`?

**YES** → Use `this.data` (go to Question 2)
**NO** → Skip to Question 4

---

#### Question 2: Do you need to control WHEN that data loads based on user actions or component parameters?

**YES** → Use `this.args` to store load parameters + `this.data` for loaded data (go to Question 3)
**NO** → Use only `this.data` (go to Question 3)

**Example - User-controlled data loading:**
```javascript
class UserList extends Jqhtml_Component {
  on_create() {
    this.args.filter = this.args.filter || 'all';  // Load parameter
    this.data.users = [];
    this.data.loaded = false;
  }

  async on_load() {
    // this.args determines what data to fetch
    this.data.users = await fetch(`/api/users?filter=${this.args.filter}`)
      .then(r => r.json());
    this.data.loaded = true;
  }

  on_ready() {
    this.$sid('filter_select').on('change', (e) => {
      this.args.filter = e.target.value;  // Change load parameters
      this.reload();                       // Re-fetch with new args
    });
  }
}
```

---

#### Question 3: Does your component also need state that is NOT loaded from an API?

**YES** → Use `this.data` for API data + `this.state` for other state
**NO** → Use only `this.data`

**Example - Component with both API data and internal state:**
```javascript
class ProductGrid extends Jqhtml_Component {
  on_create() {
    // API data
    this.data.products = [];
    this.data.loaded = false;

    // Internal state (not from API)
    this.state = {
      selected_ids: new Set(),
      view_mode: 'grid',  // 'grid' or 'list'
      sort_order: 'asc'
    };
  }

  async on_load() {
    this.data.products = await fetch('/api/products').then(r => r.json());
    this.data.loaded = true;
  }

  on_ready() {
    // Toggle view mode (internal state, no API involved)
    this.$sid('toggle_view').on('click', () => {
      this.state.view_mode = this.state.view_mode === 'grid' ? 'list' : 'grid';
      this.$.toggleClass('list-view', this.state.view_mode === 'list');
    });

    // Select product (internal state)
    this.$.on('click', '.product-card', (e) => {
      const id = $(e.currentTarget).data('product-id');
      if (this.state.selected_ids.has(id)) {
        this.state.selected_ids.delete(id);
      } else {
        this.state.selected_ids.add(id);
      }
      $(e.currentTarget).toggleClass('selected');
    });
  }
}
```

---

#### Question 4: Does your component need internal state but NO API data?

**YES** → Use `this.state` (no `this.data` needed)
**NO** → Go to Question 5

**Example - Pure UI state component:**
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

---

#### Question 5: Does your component need to store references (timers, intervals, WebSocket connections, etc.)?

**YES** → Use `this.state` to store references
**NO** → Your component likely doesn't need state properties

**Example - Component with timer reference:**
```javascript
class AutoRefresh extends Jqhtml_Component {
  on_create() {
    this.state = {
      timer: null,
      refresh_interval: 5000
    };
  }

  on_ready() {
    // Store timer reference
    this.state.timer = setInterval(() => {
      this.reload();  // Refresh data every 5 seconds
    }, this.state.refresh_interval);
  }

  on_stop() {
    // Clean up timer
    if (this.state.timer) {
      clearInterval(this.state.timer);
      this.state.timer = null;
    }
  }
}
```

---

### Quick Reference Summary

**Use `this.data` when:**
- Loading data from API in `on_load()`
- Need automatic caching and re-rendering
- Data changes should trigger DOM updates

**Use `this.args` when:**
- Configuring what data to load
- Pagination, filtering, sorting parameters
- Changing these values should trigger `reload()`

**Use `this.state` when:**
- Pure UI state (no API)
- Storing object references (timers, WebSockets)
- Manual state management (no auto-caching)
- Component has no `on_load()` or complex setup needs

**Use multiple properties when:**
- `this.data` + `this.args`: API data with user-controlled load parameters
- `this.data` + `this.state`: API data + additional UI state
- `this.args` + `this.state`: Configuration + internal state (no API)

---

### Common Mistakes

| ❌ Wrong | ✅ Correct | Why |
|---------|-----------|-----|
| `this.users = await fetch(...)` in on_load() | `this.data.users = await fetch(...)` | this.data is for API data, enables caching |
| `this.data.counter++` in on_ready() | `this.state.counter++` | this.data frozen outside on_create()/on_load() |
| `this.args.filter = 'new'` in on_load() | `this.args.filter = 'new'` in on_ready() then `this.reload()` | this.args read-only in on_load() |
| Changing this.args without reload() | `this.args.page = 2; this.reload();` | Framework needs to re-run on_load() with new args |
| `this.my_data = {...}` for API data | `this.data = {...}` | Framework can't cache arbitrary properties |
| Using this.data for timers/intervals | `this.state.timer = setInterval(...)` | this.data is for loaded data, not references |

---

### Property Comparison Table

| Property | Purpose | Mutable When | Cached | Frozen | Triggers Re-render |
|----------|---------|--------------|--------|--------|-------------------|
| `this.args` | Component configuration | Everywhere except on_load() | No | No | Only via reload() |
| `this.data` | API-loaded data | on_create(), on_load() only | Yes | Yes (Proxy) | Yes (automatic) |
| `this.state` | Internal component state | Anywhere | No | No | No (manual) |

---

### Best Practices

**1. Use `this.data` for ALL API-loaded data**
```javascript
// ✅ CORRECT
async on_load() {
  this.data = await fetch('/api/users').then(r => r.json());
}

// ❌ WRONG - Bypasses caching
async on_load() {
  this.users = await fetch('/api/users').then(r => r.json());
}
```

**2. Use `this.args` for component configuration that affects what data loads**
```javascript
// ✅ CORRECT
on_ready() {
  this.$sid('filter').on('change', async (e) => {
    this.args.filter = e.target.value;  // Change configuration
    await this.reload();                 // Re-fetch with new config
  });
}

// ❌ WRONG - No re-fetch happens
on_ready() {
  this.$sid('filter').on('change', async (e) => {
    this.args.filter = e.target.value;  // Changed but never re-fetched
  });
}
```

**3. Use `this.state` for internal component state**
```javascript
// ✅ CORRECT
on_create() {
  this.state = {expanded: false};
}
on_ready() {
  this.$sid('toggle').on('click', () => {
    this.state.expanded = !this.state.expanded;
    this.$sid('content').toggle();
  });
}

// ❌ WRONG - this.data will be frozen, can't modify in on_ready()
on_create() {
  this.data.expanded = false;
}
on_ready() {
  this.$sid('toggle').on('click', () => {
    this.data.expanded = !this.data.expanded;  // ERROR: Cannot modify frozen this.data
  });
}
```

**4. Set defaults in `on_create()`, load data in `on_load()`**
```javascript
// ✅ CORRECT
on_create() {
  this.data.loaded = false;     // Set defaults
  this.data.items = [];
}
async on_load() {
  this.data.items = await fetch('/api/items').then(r => r.json());
  this.data.loaded = true;      // Update after load
}

// ❌ WRONG - No defaults set, template may error on first render
async on_load() {
  this.data.items = await fetch('/api/items').then(r => r.json());
  this.data.loaded = true;
}
```

---

## Component Event System

JQHTML has its own component event system, separate from jQuery's DOM events.

### Component Events vs jQuery DOM Events

| | Component Events | jQuery DOM Events |
|-|------------------|-------------------|
| **Trigger** | `this.trigger('event', data?)` | `this.$.trigger('event')` |
| **Listen** | `component.on('event', callback)` | `this.$.on('event', callback)` |
| **Fire if already occurred** | Yes | No |
| **Use for** | Lifecycle events, component communication | DOM interactions, jQuery plugins |

### Event API

#### trigger(event_name, data?)

Triggers an event, firing all registered callbacks.

```javascript
// Trigger without data
this.trigger('saved');

// Trigger with data
this.trigger('selected', { item_id: 123, item_name: 'Widget' });
```

#### on(event_name, callback)

Registers a callback for an event. Callback signature: `(component, data?) => void`

- `component`: The component instance that triggered the event
- `data`: Optional data passed as second parameter to `trigger()`

```javascript
component.on('selected', (comp, data) => {
  console.log('Selected item:', data.item_id);
});
```

#### once(event_name, callback)

Like `.on()`, but fires the callback **exactly once**. Callback signature: `(component, data?) => void`

**Semantics:**
- If the event has already occurred (sticky/retroactive): the callback fires **immediately** and is **not** registered as a listener. No future firings will occur.
- If the event has not yet occurred: the callback is registered as a one-time listener. When the event fires, the callback executes and is automatically deregistered. Subsequent firings of the same event will not invoke it.
- Returns `this` for chaining.

```javascript
// If component is already loaded, fires immediately. Otherwise waits for first 'loaded' event.
component.once('loaded', (comp) => {
  console.log('Data loaded — this runs exactly once');
});

// Chaining
component.once('loaded', handleLoad).once('ready', handleReady);
```

**Use cases:**
- One-time initialization after a component finishes loading
- Waiting for a child component to become ready without accumulating listeners on reload
- Any scenario where you need to react to an event exactly once, regardless of timing

#### invalidate(event_name)

Removes the "already occurred" marker for an event. This is the opposite of `trigger()`.

**Purpose**: After calling `invalidate('ready')`:
- New `.on('ready')` handlers will NOT fire immediately
- The `ready()` promise will NOT resolve immediately
- Handlers wait for the next `trigger('ready')` call

**Existing registered callbacks are NOT removed** - they'll fire on the next `trigger()` call.

```javascript
// The framework calls invalidate('ready') internally at the start of:
// - render() - so new ready handlers wait for render to complete
// - reload() - so new ready handlers wait for reload to complete

// This ensures correct behavior for code like:
const reload_promise = component.reload();
component.on('ready', () => {
  // This handler waits for reload to complete
  // NOT firing immediately based on previous lifecycle state
  console.log('Reload complete!');
});
await reload_promise;
```

**When to use**: The framework calls this internally at the start of `render()` and `_reload()`. You typically don't need to call it directly, but it's available if you have custom lifecycle management needs.

```javascript
// Custom lifecycle management example
async custom_refresh() {
  this.invalidate('ready');  // Clear the ready state
  await this.fetch_new_data();
  this.trigger('ready');     // Re-trigger ready when done
}
```

### Fire If Already Occurred

The key feature of JQHTML's event system: **if you subscribe to an event that already happened, the callback fires immediately.**

```javascript
const component = this.sid('child');

// If 'ready' already fired, this callback runs immediately
// If not, it runs when 'ready' fires later
component.on('ready', (comp) => {
  console.log('Component is ready');
});
```

This behavior is essential for lifecycle events. Without it, subscribing to `'ready'` after a component finished loading would never fire, causing race conditions.

**Note:** When a callback fires immediately for an already-occurred event, the `data` parameter is `undefined` since the original event data is not stored.

**Resetting this behavior:** Use `invalidate(event_name)` to clear the "already occurred" marker. The framework does this automatically at the start of `render()` and `reload()` so that handlers registered mid-cycle wait for completion.

### Built-in Lifecycle Events

| Event | When It Fires |
|-------|---------------|
| `'create'` | After `on_create()` completes |
| `'render'` | After each render completes |
| `'load'` | After `on_load()` completes |
| `'loaded'` | After `on_loaded()` completes (data frozen, DOM accessible) |
| `'rendered'` | Once, after final render chain completes (before ready phase) |
| `'ready'` | After `on_ready()` completes (component fully initialized) |
| `'stop'` | When component is stopped/destroyed |

```javascript
const component = $('#my-component').component();

component.on('ready', (comp) => {
  console.log('Ready');
});
```

### Custom Component Events

Define your own events for component communication:

```javascript
class UserCard extends Jqhtml_Component {
  async save() {
    const result = await fetch(`/api/users/${this.args.user_id}`, {
      method: 'PUT',
      body: JSON.stringify(this.get_form_data())
    }).then(r => r.json());

    // Trigger custom event with data
    this.trigger('saved', { user_id: this.args.user_id, result: result });
  }
}

// Parent listening to child event
class UserList extends Jqhtml_Component {
  on_ready() {
    const card = this.sid('user_card');
    card.on('saved', (comp, data) => {
      console.log('User was saved:', data.user_id);
      this.reload();  // Refresh list
    });
  }
}
```

### When to Use Each System

**Use component events (`this.trigger()`, `component.on()`) for:**
- Lifecycle events (ready, stop)
- Component-to-component communication
- Custom application events where fire-if-already-occurred is helpful

**Use jQuery DOM events (`this.$.trigger()`, `this.$.on()`) for:**
- Actual DOM events (click, submit, resize)
- jQuery plugin integration
- Events that need to bubble through the DOM

---

## Future Feature: Smart Caching

**⚠️ COMING SOON**: Advanced caching will execute `on_load()` in facade environment.

**How it will work**:
1. Check if data exists in `sessionStorage` cache
2. If cached, render with cached data immediately
3. Simultaneously fetch live data in background
4. Compare live data to cached data
5. Only re-render if data actually changed

**Why this matters**:
- Components appear to load instantly
- User profile loaded once? Instant everywhere else
- Seamless UX with no perceived loading time

**Requirements for this to work**:
- `on_load()` must be pure data loading (no DOM manipulation)
- `on_create()` must be synchronous
- All dynamic data must go through `on_load()`

**This is why conventions exist** - future optimization requires consistent patterns today.

---

## Critical Rules Summary

### ❌ NEVER Do in on_create()
```javascript
on_create() {
  // ❌ NO ASYNC
  await fetch('/api/data');  // WRONG - use on_load()

  // ❌ NO DOM MANIPULATION
  this.$sid('title').text('Hello');  // WRONG - use on_ready()
}
```

### ❌ NEVER Do in on_load()
```javascript
async on_load() {
  this.data = await fetch('/api/data').then(r => r.json());

  // ❌ NO DOM MANIPULATION
  this.$sid('title').text(this.data.title);  // WRONG
  this.$.addClass('loaded');                // WRONG

  // ❌ NO CHILD COMPONENT ACCESS
  this.$sid('child').component().update();   // WRONG
}
```

### ✅ DO in on_render()
```javascript
on_render() {
  // ✅ Immediate DOM manipulation
  this.$.css('opacity', '0');

  // ✅ Hide uninitialized elements
  this.$sid('content').hide();

  // ✅ Set loading states
  this.$sid('status').text('Loading...');
}
```

### ✅ DO in on_ready()
```javascript
on_ready() {
  // ✅ DOM manipulation
  this.$sid('title').text(this.data.title);
  this.$.addClass('loaded');

  // ✅ Child component access
  this.$sid('child').component().update();

  // ✅ Event handlers
  this.$sid('button').on('click', () => {});

  // ✅ Hook into child events
  this.$.find('.InputComponent').each((i, el) => {
    $(el).component().on('change', () => this.handle_change());
  });
}
```

---

## Key Concepts

1. **5-stage lifecycle**: create → render → on_render → load → ready
2. **Double-render pattern**: Components may render twice if data loads
3. **this.data starts empty**: `{}` - use `Object.keys(this.data).length === 0` to detect
4. **on_render() timing**: Fires before children ready, prevents visual glitches
5. **on_ready() guarantee**: All children fully ready and accessible
6. **Bottom-up coordination**: Parents can safely access children in on_ready()
7. **Depth-ordered parallelization**: Siblings parallel, levels sequential
8. **Convention enforcement**: on_create() synchronous, on_load() no DOM
9. **Future caching**: Conventions enable smart caching feature
10. **Lifecycle manipulation**: render(), reload(), reinitialize(), stop()
11. **Synchronous requirements**: on_create(), on_render(), on_stop(), stop() must be synchronous
12. **render() is async**: Always `await this.render()` and `await this.reload()`
