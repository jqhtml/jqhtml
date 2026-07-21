# Caching & Performance

JQHTML provides two performance optimizations: **deduplication** (automatic) and **caching** (opt-in). 

## Request Deduplication (Automatic)

When multiple components with identical names and arguments load simultaneously, JQHTML executes `on_load()` only once.

```jqhtml
<% for (let comment of this.data.comments) { %>
  <UserBadge $user_id=comment.author_id />
<% } %>
```

If 20 comments from 3 unique users: **3 requests** instead of 20.

### How Deduplication Works

Components are identified by an **invocation key**: `component_name::serialized_args`

The first component (leader) executes `on_load()`. Identical components (followers) wait and receive the same data. This happens automatically—no configuration needed.

**Key implication:** Don't expect every component instance to make its own fetch request. If you see fewer network requests than component instances, deduplication is working correctly.

### Performance Impact

| Scenario | Without | With Deduplication |
|----------|---------|-------------------|
| DataGrid with 50 rows, 5 unique clients | 50 requests | 5 requests |
| 20 comments from 3 users | 20 requests | 3 requests |
| Dashboard with 3 identical status badges | 3 requests | 1 request |

### Deduplication Is Temporary

Deduplication only coordinates components loading **at the same time**. Once loading completes, the coordination is cleared. A new component with the same args will make a fresh request (unless caching is enabled).

## LocalStorage Caching (Opt-In)

Caching persists component data in localStorage using a stale-while-revalidate pattern. **Caching is disabled by default.**

### Enabling Caching

Call `jqhtml.set_cache_key()` once at application initialization:

```javascript
// app.js - Call once at startup
import jqhtml from '@jqhtml/core';

jqhtml.set_cache_key('myapp_v2.3.0_user_456_session_abc123');
```

Without this call, all cache operations are no-ops.

### Cache Modes

`set_cache_key()` accepts an optional second parameter selecting the caching strategy:

```javascript
jqhtml.set_cache_key('myapp_v2.3.0_user_456', 'data');  // default
jqhtml.set_cache_key('myapp_v2.3.0_user_456', 'html');
```

| Mode | What's Cached | Behavior |
|------|----------------|----------|
| `'data'` (default) | `this.data` after `on_load()` | Template still runs on every render. Cache just supplies instant data instead of an empty loading state. |
| `'html'` | The rendered HTML output | On a cache hit, the cached HTML is injected directly into the DOM and template rendering is skipped for that first render. `on_load()` still runs to revalidate; if it changes the data, a forced re-render runs the template normally. |

Use `'data'` mode unless you have a specific reason to skip template execution on cache hits - it's simpler to reason about and is the recommended default.

### Cache Key Convention

The cache key should include:

1. **App build identifier** - Unique hash or version for current build
2. **User ID** - So users don't see each other's cached data
3. **Session/auth state** - So cache clears on login/logout

When any of these change, the cache resets automatically. Any cache-busting strategy works—just set a new key when you want to invalidate.

```javascript
// Example: Cache key changes on each deploy and for each user session
const cache_key = `${APP_BUILD_HASH}_${user.id}_${session.id}`;
jqhtml.set_cache_key(cache_key);
```

### How Caching Works

**First Load (No Cache):**

1. Component created, no cached data
2. First render: `this.data = {}` (shows loading state)
3. `on_load()` fetches from API
4. Second render: shows data
5. Cache write: Store data in localStorage

**Subsequent Load (With Cache):**

1. Component created, cache hit
2. First render: Shows cached data immediately
3. `on_load()` revalidates in background
4. If data unchanged: No second render
5. If data changed: Second render + cache update

### Skipping Revalidation

By default, `on_load()` always runs to revalidate cached data. To skip revalidation when stale data is acceptable:

```javascript
$('#container').component('UserCard', { user_id: 123, use_cached_data: true });
```

With `use_cached_data: true`, if a cache hit occurs, `on_load()` is skipped entirely. The component renders immediately with cached data and completes its lifecycle. This is useful for performance-critical scenarios where background revalidation isn't needed.

**Note:** This option only affects data cache mode. It has no effect in HTML cache mode or when caching is disabled. Child components automatically inherit this setting from their parent.

### reload() with Cache

When `this.args` changes, `reload()` leverages the cache:

```javascript
this.$sid('filter').on('change', async (e) => {
  this.args.filter = e.target.value;
  await this.reload();
  // If filter was previously loaded: instant render from cache
  // Then revalidates in background
});
```

## Loading State Pattern

Handle loading states in templates:

```jqhtml
<Define:UserProfile>
  <% if (!this.data.name) { %>
    <div class="spinner">Loading...</div>
  <% } else { %>
    <h1><%= this.data.name %></h1>
    <p><%= this.data.email %></p>
  <% } %>
</Define:UserProfile>
```

**Without cache:** Shows spinner, then data.
**With cache:** Shows data immediately.

## Requirements for Both Features

For deduplication and caching to work:

1. **Store configuration in `this.args`** - page, filter, sort_by, etc.
2. **Load data in `on_load()`** - all data fetching here
3. **Only modify `this.data` in `on_load()`** - no DOM manipulation
4. **Call `reload()` when args change** - handles cache automatically

## Args Must Be Serializable

Both features require args to be JSON-serializable:

```javascript
// Works - primitives are serializable
<UserCard $user_id=123 $name="John" />

// Disables caching/deduplication - component reference not serializable
<ChildComponent $parent=this />
```

Use primitive values (strings, numbers, booleans) for args.

## What Gets Cached

**In data cache mode** (the default), only `on_load()` output is cached - specifically, `this.data` after `on_load()` completes.

In data cache mode, the render function always runs. Caching doesn't skip rendering - it provides instant data so the first render shows content instead of a loading spinner.

**In HTML cache mode**, the rendered HTML itself is cached, and the first render is skipped entirely on a cache hit - the cached markup is injected directly into the DOM. See [Cache Modes](#cache-modes) above.

This distinction matters when components have args that affect display but not data loading:

```javascript
// These load the SAME user data but display it differently
<UserCard $user_id=42 $show_email=true />
<UserCard $user_id=42 $show_email=false />
```

By default, these are different cache keys (separate requests) because `$show_email` differs. But `$show_email` only affects rendering - both components fetch the same user.

## Custom Cache Keys (cache_id)

Implement `cache_id()` when only some args affect data loading:

```javascript
class UserCard extends Jqhtml_Component {
  // Cache key based only on args that affect on_load()
  cache_id() {
    return `user_${this.args.user_id}`;
  }

  async on_load() {
    // Only user_id matters for data loading
    this.data = await fetch(`/api/users/${this.args.user_id}`).then(r => r.json());
  }
}
```

Now both `<UserCard $user_id=42 $show_email=true />` and `<UserCard $user_id=42 $show_email=false />` share cached data. The template handles display differences:

```jqhtml
<Define:UserCard>
  <h3><%= this.data.name %></h3>
  <% if (this.args.show_email) { %>
    <p><%= this.data.email %></p>
  <% } %>
</Define:UserCard>
```

### Other Use Cases

```javascript
class ProductGrid extends Jqhtml_Component {
  cache_id() {
    // Only category and page affect data loading
    // view_mode and sort_client_side don't - they're render-only
    return `products_${this.args.category}_page_${this.args.page}`;
  }
}
```

**When to use `cache_id()`:**
- Args contain display options that don't affect data loading
- Args contain non-serializable values but you still want caching
- You need finer control over cache granularity

## Cache Invalidation

To invalidate the cache, set a new cache key:

```javascript
// User logged out - clear their cached data
jqhtml.set_cache_key('myapp_v2.3.0_guest');

// New deployment - clear all user caches
jqhtml.set_cache_key('myapp_v2.3.1_' + user.id);
```

The framework automatically clears old JQHTML entries when the cache key changes.

## Debugging Cache Behavior

Enable verbose mode to see cache operations in the console:

```javascript
window.jqhtml.debug.verbose = true;
```

This logs cache checks, hits/misses, deduplication leader/follower decisions, and cache writes. See [Debugging](../15-debugging/) for more details on verbose mode.

## Best Practices

1. **Keep `on_load()` deterministic** - same args should return same data
2. **Use `reload()` to refresh** - don't manually re-call `on_load()`
3. **Handle empty data** - template should work even if data not yet loaded
4. **Use primitive args** - ensures cache and deduplication work correctly
5. **Set cache key on app startup** - include version, user, and session info

## Gotchas

**Display-only args create separate cache entries** - use `cache_id()` if args differ but data loading is identical (see above).

**Deduplication vs Caching:**

| Feature | Scope | Enabled |
|---------|-------|---------|
| Deduplication | Same page load | Automatic |
| Caching | Across page loads | Requires `set_cache_key()` |

## Preloading SPA Routes

Use lifecycle truncation flags to warm the cache before the user navigates to a page.

### `_load_only` — Preload a Single Component

```javascript
$('<div>').component('ProductList', { category: 'electronics', _load_only: true });
```

Runs `on_load()` to populate the cache. No render, no children, no DOM hooks. When the user navigates to the actual page, `ProductList` finds cached data and renders instantly.

### `_load_render_only` — Preload an Entire Page

```javascript
$('<div>').component('DashboardPage', { user_id: 123, _load_render_only: true });
```

Renders the full component tree so every child's `on_load()` fires. All DOM-interaction hooks (`on_render`, `on_loaded`, `on_ready`) are suppressed. When the user navigates, every component in the tree finds a cache hit.

Both flags cascade from parent to children automatically.

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/official/15_deduplication_and_caching.md` - Complete deduplication and caching specification

### Last Updated
2026-03-06

### Editorial Notes
- Separated deduplication (automatic) from caching (opt-in) clearly
- Added `set_cache_key()` documentation with convention (build + user + session)
- Added `cache_id()` method for custom cache keys
- Removed internal class references (JqhtmlLocalStorage, LoadCoordinator)
- Added verbose mode reference with link to debugging chapter
- Explained deduplication implication: fewer requests than component instances is expected
- Cache invalidation simplified to "set new cache key"
- 2025-12-10: Added `use_cached_data` section for skipping revalidation
- 2026-03-06: Added preloading SPA routes section (_load_only, _load_render_only)
- 2026-07-21: Documented `cache_mode` parameter of `set_cache_key()` and HTML cache mode; scoped the "render always runs" claim in "What Gets Cached" to data cache mode. Fixed `JqhtmlComponent` references to `Jqhtml_Component`.
