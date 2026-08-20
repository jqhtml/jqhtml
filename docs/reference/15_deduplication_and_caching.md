# Component Request Deduplication and Caching

## Overview

JQHTML provides automatic request deduplication and transparent caching for component data loading to improve performance and reduce redundant server requests.

**These optimizations work automatically** when components follow JQHTML's lifecycle conventions. No configuration or manual cache management required.

## Component Design Requirements

For deduplication and caching to work as intended, components must follow these design patterns:

1. **Store component state in `this.args`** - Maintain state like current page, sort direction, filters as properties on `this.args` (e.g., `this.args.page`, `this.args.sort_by`)

2. **Load data in `async on_load()`** - All data fetching must happen in the `on_load()` lifecycle method

3. **Only modify `this.data` in `on_load()`** - The `on_load()` method must not touch the DOM or update any component properties except `this.data`

4. **Call `reload()` when args change** - When you modify `this.args` properties and need fresh data, call `await this.reload()` to trigger smart cache-aware reloading

5. **Apply immediate render effects in `on_render()`** - Use `on_render()` for post-render effects that should show immediately (e.g., hiding uninitialized UI with `this.$.css('opacity', '0')`)

6. **Interact with children in `on_ready()`** - Use `on_ready()` for any interactions with child components that require children to be fully loaded (all children are guaranteed ready)

**Following these patterns ensures:**
- Deduplication works correctly (identical invocations share one `on_load()` execution)
- Cache keys are deterministic (based on component name + args)
- `reload()` detects args changes and leverages cache
- No race conditions or inconsistent state

---

## Request Deduplication

**Status:** ✅ Implemented
**Version:** 2.2.189+

### What It Does

When multiple components with identical names and arguments are rendered simultaneously, JQHTML automatically deduplicates their `on_load()` requests:

- **First component** (leader) executes `on_load()` normally
- **Subsequent identical components** (followers) wait for the leader to complete
- All components receive the same data without additional requests
- After all waiting components receive data, the coordination state is cleared

### How It Works

Components are identified by an **INVOCATION_KEY**:
```
INVOCATION_KEY = component_name::serialized_args
```

**Example:**
```javascript
// Three identical UserCard components
<UserCard $user_id=42 />
<UserCard $user_id=42 />
<UserCard $user_id=42 />

// INVOCATION_KEY: "UserCard::{"user_id":42}"
// Result: Only ONE fetch('/api/user/42') request
// All three components receive the same data
```

### Lifecycle Flow

**Leader Component:**
1. Reaches `on_load()` stage
2. No existing request for INVOCATION_KEY → become leader
3. Execute `on_load()` normally
4. Store promise in coordination registry
5. When complete: populate `this.data` on all waiting followers
6. Clear coordination entry

**Follower Components:**
1. Reach `on_load()` stage
2. Existing request for INVOCATION_KEY → become follower
3. **Skip** executing `on_load()`
4. Wait for leader's promise to resolve
5. Copy leader's `this.data` to own `this.data`
6. Continue lifecycle (re-render if needed, then `on_ready()`)

### Error Handling

If the leader's `on_load()` throws an error:
- All follower components receive the same error
- Error propagates to each component individually
- Coordination entry is cleared
- Future requests with same INVOCATION_KEY become new leaders (retry)

**Note:** Comprehensive error handling for `on_load()` is planned but not yet implemented. See `docs/internal/11-13-ON_LOAD_ERROR_HANDLING.md` for design considerations.

### Important Behaviors

**Request deduplication is temporary:**
- Coordination only lasts during active loading
- Once leader completes, entry is cleared immediately
- New components with same INVOCATION_KEY trigger new requests

**Why not cache?**
- Ensures fresh data on page state changes
- Works correctly with component `reload()` calls (which have their own cache integration)
- No stale data issues from deduplication alone
- Caching is a separate feature with different semantics (see below)

**This is transparent to developers:**
- No code changes needed
- Works automatically for all components
- Identical to single-component behavior from developer's perspective

### Performance Impact

**Scenario:** DataGrid with 50 rows, each row displays client name via ClientName component

**Before deduplication:**
- 50 identical `ClientName` components
- 50 AJAX requests to `/api/client/{id}/name`
- Sequential or parallel requests (browser limit: ~6 concurrent)
- Total time: High latency × request batches

**After deduplication:**
- 50 identical components, but only unique `$client_id` values matter
- If 10 unique clients: **10 AJAX requests** (instead of 50)
- All components with same client_id share one request
- Total time: Significant reduction

### Example Use Cases

1. **Repeated User Badges:**
```jqhtml
<% for (let comment of this.data.comments) { %>
  <Comment $comment_id=comment.id>
    <!-- Each comment shows author -->
    <UserBadge $user_id=comment.author_id />
  </Comment>
<% } %>
```
If 20 comments from 3 users: **3 requests** instead of 20

2. **DataGrid Lookup Columns:**
```jqhtml
<% for (let row of this.data.rows) { %>
  <tr>
    <td><ClientName $client_id=row.client_id /></td>
    <td><%= row.amount %></td>
  </tr>
<% } %>
```
If 100 rows, 5 unique clients: **5 requests** instead of 100

3. **Nested Repeated Components:**
```jqhtml
<Dashboard>
  <WidgetSales><StatusBadge $status="active" /></WidgetSales>
  <WidgetUsers><StatusBadge $status="active" /></WidgetUsers>
  <WidgetRevenue><StatusBadge $status="active" /></WidgetRevenue>
</Dashboard>
```
Three identical StatusBadge components: **1 request** instead of 3

### Gotchas

**Args must be identical:**
```javascript
// These are DIFFERENT INVOCATION_KEYs:
<UserCard $user_id=42 $show_email=true />
<UserCard $user_id=42 $show_email=false />
// Result: 2 separate requests
```

**Object property order matters:**
```javascript
// JQHTML sorts arg keys before serializing (not a JSON.stringify built-in
// behavior), so these ARE the same:
<Component $a=1 $b=2 />
<Component $b=2 $a=1 />
// Result: 1 request (keys sorted before serialization)
```

**Timing matters:**
```javascript
// These load in parallel → deduplication works
<UserCard $user_id=42 />
<UserCard $user_id=42 />

// If first completes before second starts → separate requests
// (But this is rare due to parallel sibling processing)
```

**Plain-data object args are keyed by content; anything else is not keyed at all.**

Templates rebuild `{parent_id: 12}` on every render, so an object arg can never match by
identity. Rather than opt such components out of caching, the CACHE keys them by
deterministic content: two structurally equal objects produce the same key.

The keyable set is deliberately narrow — `null`, `undefined`, booleans, numbers, strings,
`Date`, arrays, and plain objects (prototype `Object.prototype` or null), nested in any
combination. Object keys are sorted recursively; array order is preserved; the encoding
includes each value's shape, so `{a: 1}`, `[1]` and `"1"` cannot collide.

Anything else DECLINES rather than being approximated:

| Reason | Cause |
|--------|-------|
| `function` | a function anywhere in the value |
| `symbol` / `bigint` | a symbol or bigint |
| `dom-node` / `jquery` | a DOM node or jQuery object |
| `circular` | a circular reference |
| `non-plain-object` | a class instance, `Map`, `Set`, `RegExp`, … |
| `too-large` | serializes to more than 500 bytes |
| `invalid-date` | an unparseable `Date` |
| `cache-id-threw` | the component's own `cache_id()` threw |

Declining is not conservatism for its own sake. A serializer that DROPPED a function — as
`JSON.stringify` silently does — would make two argument objects differing only by a callback
produce the same key, and the component would render another component's cached content. A
false cache hit is strictly worse than no caching.

```javascript
// Keyed by content - cached, and stable across renders
<Rows_List $params={parent_type: 'Contact_Model', parent_id: 12} />
<Picker $ids=[1, 2, 3] />

// Declines - a callback is real identity that content cannot express
<Rows_List $params={parent_id: 12, on_select: this.handle} />

// Declines - a class instance; two classes with equal fields would collide
<Widget $model=contact_model_instance />
```

**Deduplication does NOT use content keys.** It still requires primitive args or an
author-supplied id. This asymmetry is deliberate: a deduplicated follower never runs
`on_load()` and adopts the leader's data with no revalidation, so a wrong key there is
permanently wrong data, while a wrong cache key is corrected on the next revalidation. The
cost of staying strict is redundant concurrent requests — the cheaper failure.

**Overriding identity.** `._jqhtml_cache_id` on the value, or a `jqhtml_cache_id()` method on
it, always takes precedence over content serialization. A component whose identity is not
derivable from its args at all — one that legitimately takes a function — should define
`cache_id()` on the component itself.

**What happens when an arg cannot be keyed:**
1. Component still functions normally; `on_load()` executes as expected
2. Caching is disabled for that instance — no localStorage reads/writes
3. Deduplication is disabled — it executes its own `on_load()`
4. SSR preload is disabled — preload lookup is keyed by cache key, so a null key can never
   match a captured entry (see `21_server_side_rendering.md`)
5. The element is marked `data-nocache="<arg>:<reason>"`
6. In development, a console warning names the arg, the reason, and the fix
7. Nothing throws

**Implementation:** content serialization lives in `packages/core/src/cache-key-serializer.ts`.
It is deliberately SEPARATE from `process_for_serialization()` in `local-storage.ts`, and the
two must not be merged — they have inverted failure policies. Cache-VALUE serialization is
permissive: it stores what it can and a lossy round-trip merely costs a re-fetch. Cache-KEY
serialization must be strict, because a lossy key silently maps two different inputs onto one
entry. Any future "cleanup" that unifies them reintroduces exactly the false-hit bug the
decline list exists to prevent.

### Null Keys Are Never Coordination Keys

An un-keyable component yields a `null` invocation key. `Map` accepts `null` as a perfectly
valid key, so without an explicit guard every un-keyable component on the page would share a
single coordination entry — and a follower could adopt an unrelated component's data. The
Load Coordinator therefore short-circuits before touching the registry:

```javascript
// should_execute_on_load()
if (key === null) { return true; }      // no identity means no coordination: always load

// register_leader()
if (key === null) { return () => {}; }  // no-op release handle
```

This is reachable in normal use whenever a component defines `cache_id()` while its args stay
un-keyable — the cache path succeeds via `cache_id()` while the dedup path still produces
`null`. Source: `packages/core/src/load-coordinator.ts`.

**Best practice:** pass plain data. Objects and arrays of primitives are keyed automatically,
so passing `{parent_type, parent_id}` is fine and preferred over flattening it. Pass ids
rather than model instances, and keep callbacks out of objects that also carry data — a
callback in its own arg still declines the whole component, so use `cache_id()` when a
component genuinely needs one.

---

## Component Caching

**Status:** ✅ Implemented (v2.2.196+)

### What It Does

Automatic persistent caching of component data in localStorage to improve performance across page state changes and provide instant loading for previously-loaded components.

---

## Choosing a Cache Mode (Developer Guide)

JQHTML provides two optional caching mechanisms that make all components appear to load instantly. Both work with whatever external data source or strategy you use to fetch data from a server—the difference is in what gets cached and what trade-offs apply.

### Data Mode (`'data'`)

**What it does:** Caches `this.data` (the result of `on_load()`) in localStorage. On subsequent loads, the cached data is restored instantly, the component renders immediately, then `on_load()` revalidates in the background.

**The trade-off:** Data returned from `on_load()` must be serializable. If you return ES6 class instances (like ORM model objects), you need to register those classes for serialization—otherwise they'll be restored as plain objects without their methods.

**For most developers:** If your `on_load()` returns plain JavaScript objects (like you'd get from `JSON.parse()` of an API response), data mode works out of the box. This is the typical case.

**If you use ORM-style class instances:** Register each class with `jqhtml.register_cache_class(ClassName)` before any components load. The framework will then preserve the class prototype chain through the cache.

**Advantages:**
- Full `this.data` access everywhere (template, `on_render()`, `on_ready()`)
- With a fully cached page, all components load and validate their data simultaneously—dramatically faster stale page refresh
- Class instances can be preserved with proper registration

### HTML Mode (`'html'`)

**What it does:** Caches the rendered DOM HTML after all children are ready. On subsequent loads, the cached HTML is injected directly, skipping template execution entirely.

**The trade-off:** On cache hit, the template isn't executed initially, but `on_load()` still runs and a re-render happens automatically. This means `this.data` is always available by the time `on_render()` executes.

**Think of it as "safe mode" caching:** It sidesteps all serialization complexity. No class registration needed. Works with any data structure `on_load()` returns.

**Advantages:**
- Zero serialization concerns—cache the rendered result, not the data
- Potentially faster cache restore for complex templates (up to 50% faster for heavy scenes—no template execution)
- `on_render()` works normally with full `this.data` access after cache restore

**Limitations:**
- Slightly larger cache footprint (HTML strings vs JSON data)
- Only caches components that modify `this.data` in `on_load()` (static components skip caching)

### Which Should I Use? (Decision Tree)

**1. Does your framework handle this for you?**
   - If you're using a JQHTML integration (like RSpade), check if it configures caching automatically. If so, it's probably data mode with proper class registration—you don't need to do anything.

**2. Does `on_load()` return ES6 class instances (ORM objects with methods)?**
   - **No** → Use **data mode**. It works automatically.
   - **Yes** → Continue to question 3.

**3. Do you want class instances preserved through the cache?**
   - **No** (you can reconstruct them in `on_ready()` or don't need methods) → **HTML mode** is simpler, no class registration needed.
   - **Yes** → Use **data mode**, but you must register your ES6 classes.

**4. Do you want the most complete integration possible?**
   - Use **data mode** and register every ES6 class that might appear in `this.data`. This can be done manually or through automation in your codebase.

### Quick Setup Examples

**Data mode (typical case):**
```javascript
// No class registration needed if on_load() returns plain objects
jqhtml.set_cache_key(`${BUILD_HASH}_${user_id}`);
```

**Data mode (with ORM classes):**
```javascript
import { Contact, User, Invoice } from './models';

// Register all model classes ONCE at app startup
jqhtml.register_cache_class(Contact);
jqhtml.register_cache_class(User);
jqhtml.register_cache_class(Invoice);

// Then enable caching
jqhtml.set_cache_key(`${BUILD_HASH}_${user_id}`, 'data');
```

**HTML mode (safe mode):**
```javascript
// No class registration needed—works with any data
jqhtml.set_cache_key(`${BUILD_HASH}_${user_id}`, 'html');
```

---

### Cache Modes

JQHTML supports two caching strategies:

| Mode | Description | When to Use |
|------|-------------|-------------|
| `'data'` (default) | Caches `this.data` with ES6 class-aware serialization | **Recommended.** Works with all component patterns |
| `'html'` | Caches rendered DOM HTML after children are ready | When you need exact DOM snapshots, but has limitations |

**Recommendation:** Use `'data'` mode unless you have specific requirements for HTML caching.

### Enabling Caching

Call `jqhtml.set_cache_key()` once at application initialization:

```javascript
import jqhtml from '@jqhtml/core';

// Data mode (recommended) - explicit
jqhtml.set_cache_key('myapp_v2.3.0_user_456_session_abc123', 'data');

// Data mode - implicit (default)
jqhtml.set_cache_key('myapp_v2.3.0_user_456_session_abc123');

// HTML mode
jqhtml.set_cache_key('myapp_v2.3.0_user_456_session_abc123', 'html');
```

**Without this call, all cache operations are no-ops.** Components will still work, but localStorage caching is disabled.

### Checking Current Cache Mode

```javascript
const mode = jqhtml.get_cache_mode();  // Returns 'data' or 'html'
```

### Cache Key Convention

The cache key should include values that, when changed, should invalidate the entire cache:

1. **App build identifier** - Unique hash or version for current build (invalidates on deploy)
2. **User ID** - So users don't see each other's cached data
3. **Session/auth state** - So cache clears on login/logout

```javascript
// Example: Cache key changes on each deploy and for each user session
const cache_key = `${APP_BUILD_HASH}_${user.id}_${session.id}`;
jqhtml.set_cache_key(cache_key);
```

**Scope validation:** When `set_cache_key()` is called, the framework checks if the key changed since last page load. If changed, all JQHTML cache entries are automatically cleared (other localStorage data is preserved).

**Framework version is part of the scope.** `set_cache_key()` does not validate against the
caller's key alone — it composes a scope marker of `<core_version>::<cache_key>` and validates
against that. Upgrading `@jqhtml/core` therefore changes the scope and clears all JQHTML cache
entries automatically, without the integrator versioning anything.

This exists because a cache entry written by an older core may not match what the current
version expects to read back. Clearing on upgrade is cheap — one repopulation from the network
on first load — while deserializing a stale shape is a silent correctness bug.

Two consequences for the documented convention above:

- The **app build identifier** is still the caller's responsibility. It invalidates on *your*
  deploys, which the framework knows nothing about.
- A jqhtml version in the cache key is redundant. `set_cache_key('myapp_v2.3.0_...')` reads as
  though it refers to the framework; it should identify the application's own build.

The version is deliberately kept in the scope marker rather than in each stored key, so the
per-entry key format (`jqhtml::<cache_key>::<developer_key>`) stays readable and does not
repeat the version in every entry. Implementation: `_scope_marker` and `_validate_scope()` in
`packages/core/src/local-storage.ts`.

### Cache Entry Size Limit

**Each cache entry is capped at 1MB (serialized size).** This applies to both data mode (`this.data`) and HTML mode (rendered HTML string).

**What happens on overflow:**
1. The value fails to be written to localStorage
2. Any existing cache entry for that key is removed (so a future load sees a cache miss, not stale data)
3. The component still functions normally—`on_load()` still runs, data still loads—caching for that entry is simply skipped
4. No error is thrown; the failure is silent unless verbose mode is enabled

**How to diagnose it:** Enable verbose mode (`window.jqhtml.debug.verbose = true`) to see a console warning like:

```
[JQHTML Cache] Skipping set - value too large (1.42MB > 1MB limit)
```

**If you hit this limit:** Reduce the size of `this.data` (e.g. paginate, trim unused fields before returning from `on_load()`), or switch that component away from caching if the payload is inherently large.

---

## Data Cache Mode (Recommended)

**Mode identifier:** `'data'`

Data mode caches the `this.data` object after `on_load()` completes. On subsequent loads, the cached data is hydrated into `this.data` during `create()`, allowing immediate rendering with cached content while `on_load()` revalidates in the background.

### How Data Mode Works

1. **Cache Read (create stage):** Framework checks localStorage for cached data using INVOCATION_KEY
2. **Hydrate:** If cache hit, populate `this.data` with cached object
3. **First Render:** Template renders immediately with cached data
4. **Revalidation:** `on_load()` executes to fetch fresh data
5. **Cache Write:** After `on_load()`, updated `this.data` is written to cache
6. **Conditional Re-render:** Only re-renders if data changed

### ES6 Class Serialization

Data mode supports ES6 class instances in `this.data`. Classes are serialized with their constructor name and restored with full prototype chain intact.

**Built-in types (no registration needed):** `Date`, `Map`, and `Set` instances in `this.data` are automatically preserved through the cache—serialized and restored with the same markers used for registered classes, but without calling `register_cache_class()`. This is distinct from custom ES6 classes below, which DO require registration.

**Registering classes for cache serialization:**

```javascript
import jqhtml from '@jqhtml/core';

// Define your class
class Contact_Model {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }

  get_display_name() {
    return `${this.name} <${this.email}>`;
  }
}

// Register for cache serialization
jqhtml.register_cache_class(Contact_Model);
```

**How serialization works:**

```javascript
// Original object
this.data.contact = new Contact_Model('John', 'john@example.com');

// Serialized to localStorage as:
{
  "contact": {
    "__jqhtml_class__": "Contact_Model",
    "__jqhtml_props__": { "name": "John", "email": "john@example.com" }
  }
}

// Restored from cache:
this.data.contact instanceof Contact_Model  // true
this.data.contact.get_display_name()        // "John <john@example.com>"
```

**Class registration requirements:**
- Class must be registered before any component that uses it is created
- Class name must be unique across registered classes—this is a convention you must follow manually, not something the framework validates. Registering two different classes under the same name silently overwrites the earlier registration with no warning or error.
- Only own properties are serialized (not prototype methods)
- Nested class instances are supported

**Without registration:** Unregistered class instances are serialized as plain objects. Methods will not be available after cache restoration.

### Data Mode Advantages

- **Full `this.data` access in all lifecycle methods** - Template, `on_render()`, and `on_ready()` can all use `this.data`
- **ES6 class support** - Class instances restored with prototype chain
- **Stale-while-revalidate** - Instant render with cached data, background refresh
- **Smart re-rendering** - Only re-renders if data actually changed

### Hot/Cold Cache Parity (Data Mode)

**Purpose:** Ensure "hot" data (fresh from `on_load()`) behaves identically to "cold" data (restored from cache).

In data mode, after `on_load()` completes, `this.data` is automatically passed through a serialize/deserialize round-trip—the same process that occurs when data is written to and read from localStorage cache. This normalization happens on every `on_load()`, regardless of whether caching is enabled.

**Why this matters:**

Without this normalization, developers could write code that works perfectly during initial development (when data is "hot" from the API) but breaks mysteriously after a page reload (when data is "cold" from cache). Consider:

```javascript
class Contact_Card extends Jqhtml_Component {
  async on_load() {
    // API returns a Contact_Model instance with methods
    this.data.contact = await api.get_contact(this.args.id);
  }

  async on_ready() {
    // Works on first load (hot data - class instance intact)
    // BREAKS after page reload (cold data - plain object, no methods)
    const name = this.data.contact.get_display_name();
  }
}
```

**With hot/cold cache parity:**

The normalization immediately converts unregistered class instances to plain objects, causing the code to fail on first load rather than only after a cache restore. This makes the bug visible during development.

**The fix is simple:** Register any ES6 classes that need to survive caching:

```javascript
// Register before any components load
jqhtml.register_cache_class(Contact_Model);
```

**Technical behavior:**

1. After `on_load()` completes, `this.data` is serialized to JSON
2. The JSON is immediately deserialized back to an object
3. Registered classes are restored with their prototype chain
4. Unregistered classes become plain objects (properties preserved, methods lost)
5. The normalized data replaces `this.data`

**This guarantees:**
- Fresh data behaves exactly like cached data
- Missing class registrations are caught immediately, not on page reload
- No "works in dev, breaks in prod" surprises from cache behavior

**Shared (non-circular) references between `this.data` keys:**

If the same object or array is assigned to two different `this.data` keys (e.g. `this.data.selected = this.data.items[0]`), that's a shared reference (a DAG), not a circular reference—it's fully supported and does NOT disable caching. Both keys serialize successfully and both come back with their values intact after a cache round-trip.

**What is lost:** Object identity between the two keys. Before caching, `this.data.selected === this.data.items[0]` would be `true` in memory. After a serialize/deserialize round-trip (hot/cold parity normalization, or an actual cache write/restore), each occurrence is serialized independently, so `this.data.selected === this.data.items[0]` becomes `false`—they're now two separate objects with the same contents, not the same object. Only genuine circular references (an object that (in)directly contains itself) disable serialization; shared references without a cycle serialize fine, just without preserved identity.

---

## HTML Cache Mode

**Mode identifier:** `'html'`

HTML mode caches the rendered DOM innerHTML after children are ready but before `on_ready()` is called. On subsequent loads, the cached HTML is injected directly into the DOM.

### How HTML Mode Works

1. **Cache Read (create stage):** Framework checks localStorage for cached HTML
2. **First Render:** If cache hit, innerHTML is set directly from cache (skipping template execution)
3. **on_load() executes:** Populates `this.data` for revalidation
4. **Force Re-render:** After `on_load()`, component re-renders with fresh data
5. **Wait for Children:** All child components complete their lifecycle
6. **Cache Write (before on_ready):** DOM innerHTML is captured and written to cache
7. **on_ready() executes:** Post-render lifecycle continues

### HTML Mode Timing

The HTML snapshot is taken at a specific point in the lifecycle:

```
_render() → children boot → _wait_for_children_ready() → [SNAPSHOT HERE] → on_ready()
```

This ensures:
- All child components are fully rendered
- All nested content is present
- Snapshot captures complete DOM tree

### HTML Mode Behaviors

**`this.data` is accessible in `on_render()` — but not on the very first cache-hit call**

On a cache hit, `on_render()` is called **twice**:

1. **Immediately after cached HTML injection** — `this.data` still has only the `on_create()` defaults at this point (the same as any fresh/uncached render). `on_load()` has not run yet.
2. **Again after `on_load()` completes** (forced re-render, because `_used_cached_html` was set) — `this.data` now has the freshly loaded data.

```javascript
on_create() {
  this.data.user = null;  // Default so the first on_render() call doesn't throw
}

on_render() {
  // Guard against the first (pre-on_load) call on a cache hit —
  // this.data.user is only populated by the second, forced on_render() call.
  if (this.data.user) {
    this.$sid('username').text(this.data.user.name);
  }
}
```

**How it works:** When cached HTML is restored, `on_render()` fires once right away with only `on_create()` defaults, then a forced re-render happens after `on_load()` completes so `on_render()` runs again with populated `this.data`. Code in `on_render()` that unconditionally reads deep/nested `this.data` fields (like `this.data.user.name`) must guard against the first call, in both HTML mode and data mode.

**Dynamic vs Static Components:**

HTML mode only caches components that modify `this.data` during `on_load()` (dynamic components). Static components (where `on_load()` doesn't change `this.data`) don't need caching since they render identically each time.

**Synchronization:**

Before caching HTML, parent components wait for all children's `on_render()` to complete. This ensures the cached snapshot includes fully rendered child content.

**Other considerations:**
- Larger cache size (full HTML vs JSON data)
- Child component state not preserved (they re-initialize)

### When to Use HTML Mode

HTML mode is useful when:
- Component template is expensive to execute
- You need exact DOM structure preserved
- Data is simple and doesn't require class instances
- You want to avoid ES6 class serialization complexity

---

## Cache Implementation Specification (Reference Blueprint)

**PURPOSE: This section is the authoritative specification for cache behavior.**

When reviewing or modifying cache-related code in `component.ts`, compare the implementation against this specification. Any discrepancy between the code and this specification should be resolved by either:
1. Fixing the code to match the specification, OR
2. Updating the specification if the behavior change is intentional

**Source files:** `packages/core/src/component.ts`, `packages/core/src/local-storage.ts`

---

### Data Mode Specification (`cache_mode = 'data'`)

#### Phase 1: create() — Cache Read

**Location in component.ts:** `create()` method, after `on_create()` completes

**Pseudocode:**

```
1. Call on_create() — user sets this.data defaults
2. Generate cache_key from component_name + serialized args
   - If args contain non-serializable values: disable caching, continue
   - If component implements cache_id(): use that instead
3. Store cache_key in this._cache_key for later use
4. Get cache_mode from Jqhtml_Local_Storage.get_cache_mode()
5. IF cache_mode is 'data':
   a. Read cached_data from localStorage using cache_key
   b. IF cached_data exists AND is object:
      - Deserialize with ES6 class restoration (registered classes)
      - Assign to this.data (REPLACES on_create defaults)
   c. ELSE: cache miss, continue with on_create() defaults
6. Snapshot this.data for on_load() restoration: __initial_data_snapshot = deep_clone(this.data)
7. Freeze this.data (__data_frozen = true)
8. Trigger 'create' event
```

**Key behavior:** Cached data REPLACES `on_create()` defaults. First render uses cached data if available.

---

#### Phase 2: _render() — First Render

**Location in component.ts:** `_render()` method

**Pseudocode:**

```
1. Increment _render_count
2. IF this._cached_html exists (html mode only): skip to HTML injection path
3. ELSE: Execute template with current this.data
4. process_instructions() creates DOM and boots child components
5. Call on_render() synchronously
6. Trigger 'render' event
7. Store _args_on_last_render = deep_clone(this.args)
8. Store _data_on_last_render = JSON.stringify(this.data)
```

**Key behavior:** In data mode, first render uses hydrated cached data (or empty defaults if cache miss).

---

#### Phase 3: _load() — Data Fetch, Normalize, and Cache Write

**Location in component.ts:** `_load()` method

**Pseudocode:**

```
1. IF not first load: Restore this.data from __initial_data_snapshot
2. Unfreeze this.data (__data_frozen = false)
3. Snapshot data_before_load = JSON.stringify(this.data)
4. Check load deduplication (leader/follower coordination)
5. IF leader:
   a. Create restricted proxy (blocks this.$, this.$sid, etc.)
   b. Call on_load() with restricted context
   c. Notify followers with loaded data
6. IF follower:
   a. Wait for leader's promise
   b. Copy leader's this.data to own this.data
7. IF cache_mode is 'data':
   —— HOT/COLD CACHE PARITY NORMALIZATION ——
   a. Serialize this.data to JSON (with class-aware serialization)
   b. Deserialize JSON back to object (restoring registered classes)
   c. Replace this.data with normalized result
   d. Unregistered class instances become plain objects
   e. This ensures fresh data behaves identically to cached data
8. Freeze this.data (__data_frozen = true)
9. Compare data_after_load = JSON.stringify(this.data)
10. IF data changed AND data is not empty '{}':
    a. Get cache_mode from Jqhtml_Local_Storage
    b. IF cache_mode is 'data':
       - Write this.data to localStorage via Jqhtml_Local_Storage.set(cache_key, this.data)
       - ES6 classes serialized with __jqhtml_class__ wrapper
    c. IF cache_mode is 'html':
       - Set flag: this._should_cache_html_after_ready = true
       - (Actual HTML caching happens later in _ready())
11. Trigger 'load' event
```

**Key behaviors:**
- Data mode normalizes `this.data` after `on_load()` via serialize/deserialize round-trip
- This ensures "hot" data behaves identically to "cold" cached data
- Unregistered classes lose methods immediately (not just after page reload)
- Data mode writes cache immediately after `on_load()`. HTML mode defers to `_ready()`.

---

#### Phase 4: Conditional Re-render

**Location in component.ts:** Orchestrated by `LifecycleManager`

**Pseudocode:**

```
1. Call _should_rerender()
2. IF data changed (comparing current this.data vs _data_before_render):
   - Call _render() again with updated this.data
   - Executes template, updates DOM
   - Boots any new child components
   - Calls on_render() again
3. IF data unchanged: Skip second render
```

**Key behavior:** Double-render only happens if `on_load()` modified `this.data`.

---

#### Phase 5: _ready() — Children Ready, Then on_ready

**Location in component.ts:** `_ready()` method

**Pseudocode:**

```
1. Call _wait_for_children_ready() — waits for all child components to reach ready state
2. IF this._should_cache_html_after_ready AND cache_mode is 'html':
   a. Clear flag: this._should_cache_html_after_ready = false
   b. Capture HTML: html = this.$.html()
   c. Write to cache: Jqhtml_Local_Storage.set(cache_key + '::html', html)
   d. NOTE: This is where HTML snapshot is taken — AFTER children ready, BEFORE on_ready
3. Call on_ready()
4. Trigger 'ready' event
```

**Key behavior:** HTML cache is written at this point, capturing fully rendered DOM with all children.

---

### HTML Mode Specification (`cache_mode = 'html'`)

#### Phase 1: create() — Cache Read

**Location in component.ts:** `create()` method, after `on_create()` completes

**Pseudocode:**

```
1. Call on_create() — user sets this.data defaults
2. Generate cache_key (same as data mode)
3. Store cache_key in this._cache_key
4. Get cache_mode from Jqhtml_Local_Storage.get_cache_mode()
5. IF cache_mode is 'html':
   a. Read cached_html from localStorage using cache_key + '::html'
   b. IF cached_html exists AND is string:
      - Store in this._cached_html (DO NOT inject yet)
   c. ELSE: cache miss
6. Snapshot this.data for on_load() restoration
7. Freeze this.data
8. Trigger 'create' event
```

**Key behavior:** HTML is stored but NOT injected yet. `this.data` still has `on_create()` defaults.

---

#### Phase 2: _render() — Cached HTML Injection

**Location in component.ts:** `_render()` method, HTML cache path

**Pseudocode:**

```
1. Increment _render_count
2. IF this._cached_html is NOT null:
   a. Inject directly: this.$[0].innerHTML = this._cached_html
   b. Set flag: this._used_cached_html = true
   c. Clear: this._cached_html = null
   d. Mark: this._did_first_render = true
   e. Skip template execution entirely
   f. Call on_render() (this.data has on_create() defaults at this point)
   g. Trigger 'render' event
   h. Store args/data snapshots
   i. Return early
3. ELSE: Execute template normally, then call on_render()
```

**Key behavior:** After cached HTML injection, `_used_cached_html` flag triggers forced re-render after `on_load()`. This ensures `on_render()` is called again with populated `this.data`.

---

#### Phase 3: _load() — Data Fetch and Dynamic Detection

**Location in component.ts:** `_load()` method

**Pseudocode:**

```
1-9. (Same as data mode — restore snapshot, call on_load(), etc.)
10. Track if component is dynamic:
    - Compare data_before_load vs data_after_load
    - Set this._is_dynamic = true IF data changed AND is not empty '{}'
11. IF _is_dynamic AND cache_mode is 'html':
    - Set flag: this._should_cache_html_after_ready = true
    - DO NOT write to cache yet (HTML not rendered with fresh data yet)
```

**Key behavior:** Only components that actually modify `this.data` in `on_load()` are flagged as "dynamic" and eligible for HTML caching. Static components (empty `on_load()` or no data changes) skip caching since they render identically each time.

---

#### Phase 4: Forced Re-render

**Location in component.ts:** `_should_rerender()` method

**Pseudocode:**

```
1. IF this._used_cached_html is true:
   a. Clear flag: this._used_cached_html = false
   b. Return true — FORCE re-render
2. ELSE: Compare this.data vs _data_before_render (standard check)
```

**Key behavior:** After cached HTML injection, `_should_rerender()` ALWAYS returns true to force a real render with fresh data from `on_load()`.

---

#### Phase 5: _ready() — HTML Cache Write with Child Synchronization

**Location in component.ts:** `_ready()` method

**Pseudocode:**

```
1. Call _wait_for_children_ready()
2. IF this._should_cache_html_after_ready AND this._is_dynamic:
   a. Call _wait_for_children_on_render()
      - Waits for all child components' _on_render_complete flag
      - Ensures children have finished their post-on_load renders
   b. Capture: html = this.$.html()
   c. Write: Jqhtml_Local_Storage.set(cache_key + '::html', html)
   d. Clear flag
   —— SNAPSHOT POINT: After children's on_render() complete, before on_ready() ——
3. Call on_ready()
4. Trigger 'ready' event
```

**Key behavior:** HTML cache captures the DOM state with:
- All children's `on_render()` lifecycle completed (not just ready state)
- Fresh data from `on_load()` reflected in DOM
- Only dynamic parents cache (static parents skip)
- Before any `on_ready()` DOM manipulation

**Why `_wait_for_children_on_render()`:**

The standard `_wait_for_children_ready()` waits for children to be fully ready, but the HTML snapshot needs to be taken after children have executed their `on_render()` with populated `this.data`. The `_on_render_complete` flag is set after a component's post-`on_load()` render, ensuring proper synchronization.

---

### reload() Cache Behavior

**Location in component.ts:** `_reload()` method

**Pseudocode:**

```
1. Check if args changed since last render (_args_on_last_render)
2. IF args changed:
   a. Generate new cache_key from current args
   b. IF cache_mode is 'data':
      - Read cache for new args
      - IF cache hit: hydrate this.data, call render(), set rendered_from_cache = true
   c. IF cache_mode is 'html':
      - Read HTML cache for new args
      - IF cache hit: store in _cached_html, call render(), set rendered_from_cache = true
3. Restore this.data to __initial_data_snapshot
4. Call on_load() to fetch fresh data
5. IF data changed AND non-empty:
   a. IF cache_mode is 'data': Write this.data to cache immediately
   b. IF cache_mode is 'html': Set _should_cache_html_after_ready = true
6. IF should_render (based on force_refresh flag and data change):
   - Call _render()
7. Wait for children ready
8. IF rendered: Call on_ready()
```

**Key behavior:** `reload()` leverages cache for instant render when args change (stale-while-revalidate).

---

### Cache Key Format

| Mode | Cache Key Format |
|------|------------------|
| Data | `ComponentName::{"arg1":"value1","arg2":"value2"}` |
| HTML | `ComponentName::{"arg1":"value1","arg2":"value2"}::html` |

HTML mode appends `::html` suffix to distinguish from data cache entries.

---

### Lifecycle Timeline Summary

```
INITIAL BOOT (cache hit):

Data Mode:
  create()
    └─ on_create() sets defaults
    └─ Cache read: this.data = cached_data (REPLACES defaults)
    └─ Freeze this.data
  _render()
    └─ Template executes with cached this.data
    └─ on_render()
  _load()
    └─ Restore this.data to defaults
    └─ on_load() fetches fresh data
    └─ NORMALIZE: serialize/deserialize round-trip (hot/cold parity)
    └─ Cache write: save this.data
    └─ Freeze this.data
  [conditional re-render if data changed]
  _ready()
    └─ Wait for children
    └─ on_ready()

HTML Mode:
  create()
    └─ on_create() sets defaults
    └─ Cache read: store cached HTML (don't inject yet)
    └─ Freeze this.data (still has defaults)
  _render()
    └─ Inject cached HTML directly (skip template)
    └─ on_render() (this.data has defaults only)
    └─ Set _used_cached_html = true
  _load()
    └─ on_load() fetches fresh data
    └─ Track _is_dynamic if data changed
    └─ Set _should_cache_html_after_ready = true (if dynamic)
    └─ Freeze this.data
  _should_rerender()
    └─ Returns true (forced by _used_cached_html flag)
  _render()
    └─ Template executes with fresh this.data
    └─ on_render() (this.data fully populated)
    └─ Set _on_render_complete = true
  _ready()
    └─ Wait for children ready
    └─ Wait for children's on_render complete (_wait_for_children_on_render)
    └─ Cache write: save HTML (only if dynamic)
    └─ on_ready()
```

---

## Caching Lifecycle Flow (Data Mode)

**Initial Boot Flow:**

**1. create() - Cache Read**
- Framework checks localStorage for cached data using INVOCATION_KEY
- In 'data' mode: cached data is deserialized with ES6 class restoration
- In 'html' mode: cached HTML string is stored for direct DOM injection
- If cached data exists and is non-empty (`!== {}`):
  - Hydrate `this.data` with cached data (data mode)
  - Or store cached HTML for render injection (html mode)
  - Render immediately with cached content
  - Continue to `load()` for revalidation
- If no cached data or data is empty `{}`:
  - Continue with normal lifecycle

**2. load() - Data Fetch and Cache Write**
- Execute `on_load()` with deduplication (followers skip execution)
- Compare `this.data` before and after `on_load()`
- If data changed AND data is not empty `{}`:
  - Write to localStorage cache
  - Trigger re-render if needed
- If data unchanged:
  - Skip cache write and second render

**reload() Flow with Smart Cache Integration:**

**Important:** `reload()` is automatically debounced:
- Multiple rapid calls are coalesced into a single execution
- If called while `on_load()` is running, additional calls are queued
- Only the most recent call executes if multiple are queued
- All callers receive the same promise, resolved when execution completes

**1. Args Change Detection**
- Compare `this.args` with snapshot from last render (`_args_on_last_render`)
- If args changed:
  - Try to read cache for **new args**
  - If cache hit with non-empty data:
    - Hydrate `this.data` with cached data
    - Render immediately (stale-while-revalidate)
  - Mark that we rendered from cache

**2. Revalidation via on_load()**
- Restore `this.data` to `on_create()` snapshot
- Call `on_load()` to fetch fresh data
- Compare data before/after load

**3. Conditional Render**
- Render if: (a) didn't render from cache yet, OR (b) data changed after load
- Skip second render if cache was fresh (data unchanged)

**4. Wait for Children Ready**
- Wait for all child components to be ready (bottom-up ordering)

**5. Call on_ready()**
- Run `on_ready()` after children are ready

### Example Flows

**First Load (No Cache):**
```javascript
// create() - Check cache → no cached data
// First render: this.data = {} (empty)
// on_load() fetches from API: this.data = {name: "John", id: 42}
// Data changed (from {} to populated) → second render shows "John"
// Cache write: Store {name: "John", id: 42} in localStorage
```

**Subsequent Boot (With Cache):**
```javascript
// create() - Check cache → cache hit!
// Hydrate: this.data = {name: "John", id: 42}
// First render: Shows "John" immediately (from cache)
// on_load() fetches from API (validates cache)
// If API returns same data → no second render (cache was fresh)
// If API returns updated data → second render with fresh data + cache update
```

**reload() with Args Change (Cache Hit):**
```javascript
// Component previously loaded with user_id=100
// User changes filter: this.args.user_id = 200
// reload() detects args changed
// Check cache for user_id=200 → cache hit!
// Hydrate and render immediately with cached data
// load() revalidates via on_load()
// If data unchanged → skip second render
// If data changed → second render + cache update
```

**reload() with Args Change (Cache Miss):**
```javascript
// Component previously loaded with user_id=100
// User changes filter: this.args.user_id=999
// reload() detects args changed
// Check cache for user_id=999 → cache miss
// load() executes on_load() to fetch data
// Single render with fresh data
// Cache write for user_id=999
```

### Cache Benefits

**Deduplication alone:**
- 50 identical components on one page → 1 AJAX request
- But every page navigation → new request

**Deduplication + Caching:**
- 50 identical components → 1 AJAX request (deduplication)
- Cached data loads instantly on subsequent page loads
- Still revalidates via `on_load()` to ensure freshness (stale-while-revalidate pattern)
- Persists across page navigations (localStorage)
- `reload()` with args changes can leverage cache for instant updates

### Cache Invalidation

**Automatic invalidation when:**
- Browser clears localStorage
- Quota exceeded (framework clears JQHTML keys and retries)
- Data becomes stale (on_load() returns different data)
- Cache key changes (via `set_cache_key()` with different value)

**Manual invalidation:**

To invalidate the cache, set a new cache key:

```javascript
// User logged out - clear their cached data
jqhtml.set_cache_key('myapp_v2.3.0_guest');

// New deployment - clear all user caches
jqhtml.set_cache_key('myapp_v2.3.1_' + user.id);
```

The framework automatically clears old JQHTML entries when the cache key changes. This is the recommended approach.

**Cache staleness:**
- Cache entries have no TTL - they persist until cleared or overwritten
- `on_load()` always executes to revalidate cached data
- If fresh data differs from cache, cache is automatically updated

### Custom Cache Keys (cache_id Method)

By default, cache keys are generated from serialized `this.args`. If `this.args` doesn't capture what matters for caching (or contains non-serializable values), implement a `cache_id()` method:

```javascript
class ProductGrid extends Jqhtml_Component {
  // Return custom cache key instead of using serialized args
  cache_id() {
    return `products_${this.args.category}_page_${this.args.page}`;
  }

  async on_load() {
    this.data.products = await fetch(
      `/api/products?cat=${this.args.category}&page=${this.args.page}`
    ).then(r => r.json());
  }
}
```

**Final cache key format:** `ComponentName::your_cache_id_value`

**When to use:**
- Args contain non-serializable values but you still want caching
- Only some args affect the data being loaded (others are for display options)
- You need finer control over cache granularity

**Behavior:**
- `cache_id()` is called during `create()` (cache read), `_load()` (deduplication/cache write), and `_reload()` (cache read on args change)
- If `cache_id()` throws an error, caching is silently disabled for that component instance
- The component continues to function normally without caching

### Debugging Cache Behavior

Enable verbose mode to see cache operations in the console:

```javascript
window.jqhtml.debug.verbose = true;
```

**Verbose output includes:**
- Cache checks, hits, and misses during `create()`
- Deduplication leader/follower decisions
- Cache writes after `on_load()` completes
- Cache invalidation when cache key changes

Example output:
```
[Cache] Component c123 (UserCard) checking cache in create()
[Cache] Component c123 (UserCard) cache miss in create()
[Load Deduplication] Component c123 (UserCard) is the leader
[Cache] Component c123 (UserCard) updated cache after on_load()
```

### Design Goals

- **Opt-in:** Caching requires `set_cache_key()` to enable (safe by default)
- **Transparent:** Once enabled, no component code changes needed
- **Validates:** `on_load()` always executes to revalidate cached data (stale-while-revalidate)
- **Deduplication-compatible:** Works seamlessly with request deduplication
- **Graceful degradation:** Falls back silently if localStorage unavailable or full
- **Smart reload:** `reload()` leverages cache when args change for instant updates
- **No empty cache:** Only caches non-empty data (`!== {}`)
- **Customizable:** Components can override cache key via `cache_id()` method

### Cache Key Format

Cached data stored in localStorage with INVOCATION_KEY:
```
component_name::serialized_args
```

Example:
```
UserCard::{"user_id":42}
```

This is the same key format used for deduplication, ensuring cache coherence.

### Loading State Pattern

Handle loading states in templates by checking if data is populated:

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

```javascript
class UserProfile extends Jqhtml_Component {
  async on_load() {
    const response = await fetch(`/api/user/${this.args.user_id}`);
    this.data = await response.json();
  }
}
```

**Behavior:**
- **No cache:** First render shows spinner (this.data = {}), second render after on_load() shows data
- **With cache:** First render shows data immediately (hydrated from cache in create()), on_load() revalidates

### Implementation Details

**Cache read location:** `create()` stage (before first render)

**Cache write location:** `load()` stage (after `on_load()` completes)

**Cache write condition:** Only if data changed during `on_load()` AND data is not empty `{}`

**Args snapshot:** Stored in `_args_on_last_render` after each `_render()` call

**Cache storage:** Internal localStorage wrapper with automatic error handling and quota management

**Deduplication integration:** Cache uses same INVOCATION_KEY format, ensuring coherence

**Cache key override:** If component implements `cache_id()` method, that value is used instead of serialized args

---

## DOM Access Restrictions During on_load()

**Status:** ✅ Implemented (v2.2.189+)

### The Problem

`on_load()` should ONLY modify `this.data`. DOM manipulation during `on_load()` causes issues:
- Conflicts with deduplication (followers don't execute `on_load()`)
- Unpredictable behavior with async operations
- Violates lifecycle separation (data loading vs DOM manipulation)

### The Solution: Restricted Access

JQHTML prevents DOM access during `on_load()` execution by temporarily hiding DOM-related properties.

**Allowed during on_load():**
- `this.args` - Input parameters (read-only, deep-proxied—nested objects are also read-only)
- `this.data` - Component data (writable)

**Blocked (throws) during on_load():**
- `this.$` - jQuery element reference
- `this.sid()` - Get child component instance
- `this.$sid()` - Get child element by scoped ID
- `this.component_name()` - Component name
- `this.render()` / `this.reload()` / any other method
- Every other property or method on the component instance

`on_load()` does not run as a method on the real component at all. The framework builds a **detached context object**—`{ args, data }`—wrapped in a Proxy, and calls `on_load()` with `this` bound to that detached object. Because the real component instance is never in scope, there is no allowlist/denylist toggle to get wrong: anything other than `this.args` or `this.data` simply isn't reachable.

### Error Example

```javascript
class UserCard extends Jqhtml_Component {
  async on_load() {
    const response = await fetch('/api/user/' + this.args.user_id);
    this.data = await response.json();

    // ❌ This throws an error:
    this.$.addClass('loaded');
    // Error: [JQHTML] Cannot access this.$ during on_load().
    //        on_load() may only access this.args and this.data.

    // ❌ This also throws (not just DOM properties are blocked):
    this.component_name();
    // Error: [JQHTML] Cannot access this.component_name during on_load().
    //        on_load() may only access this.args and this.data.
  }
}
```

**Correct approach:**
```javascript
class UserCard extends Jqhtml_Component {
  async on_load() {
    const response = await fetch('/api/user/' + this.args.user_id);
    this.data = await response.json();
    // ✅ Only modify this.data
  }

  async on_ready() {
    // ✅ DOM manipulation and component methods happen here
    this.$.addClass('loaded');
  }
}
```

### Implementation Details

**Current Implementation: Detached Context + Allowlist Proxy**

`on_load()` never receives the real component as `this`. Instead, the framework clones `this.data` from the post-`on_create()` snapshot, wraps the real `this.args` in a read-only (deep) proxy, and combines them into a small detached `{ args, data }` object. A Proxy over that object allowlists exactly `args` and `data`; everything else throws:

```javascript
// Simplified from packages/core/src/data-proxy.ts execute_on_load_detached()

// Clone this.data from the snapshot captured after on_create()
const data_clone = JSON.parse(JSON.stringify(component.__initial_data_snapshot ?? {}));

// Read-only proxy over the real this.args (recursively wraps nested objects)
const readonly_args = create_readonly_proxy(component.args);

// Detached context on_load() actually runs against
const detached_context = { args: readonly_args, data: data_clone };

const restricted_this = new Proxy(detached_context, {
  get(target, prop) {
    if (prop === 'args') return target.args;
    if (prop === 'data') return target.data;

    // Block everything else
    throw new Error(
      `[JQHTML] Cannot access this.${String(prop)} during on_load(). ` +
      `on_load() may only access this.args and this.data.`
    );
  },
  set(target, prop, value) {
    if (prop === 'data') {
      target.data = value;
      return true;
    }
    // Block setting this.args or any other property
    throw new Error(
      `[JQHTML] Cannot modify this.${String(prop)} during on_load(). ` +
      `Only this.data can be modified in on_load().`
    );
  }
});

await component._call_lifecycle('on_load', restricted_this);
```

**Why a detached context instead of wrapping the real component:**
- ✅ Architecturally impossible to reach component methods/properties—there's no fallback `target[prop]` path to accidentally allow something
- ✅ `this.args` mutations are blocked even on nested objects (deep read-only proxy), not just top-level reassignment
- ✅ `this.data` writes during `on_load()` operate on an isolated clone, merged back into the real `this.data` only after `on_load()` resolves
- ✅ Clear error messages showing exactly which property was accessed

### Why This Matters for Deduplication

With deduplication, follower components skip `on_load()` entirely. If a leader's `on_load()` modified DOM:
- Follower components would have different DOM state than leader
- Deduplication would produce inconsistent results
- Developer expectations would be violated

By enforcing "data-only" modification in `on_load()`, we ensure all components (leader and followers) end up in identical states.

---

## Developer Guidelines

### Writing Deduplication-Friendly Components

**✅ Do:**
- Use consistent arg names and types
- Keep `on_load()` pure (same args → same result)
- Make `this.args` immutable (don't modify after creation)
- Use `on_load()` only for data fetching
- Store component-specific state on other properties (not `this.data`)

**❌ Don't:**
- Mutate `this.args` after component creation
- Use random values in `on_load()` (timestamps, Math.random(), etc.)
- Rely on `on_load()` side effects (logging, analytics, etc.)
- Store mutable state in `this.data` outside of `on_load()`

### Args vs Data vs Component State

**`this.args`** - Input parameters (immutable):
```javascript
// Set on invocation, never change
<UserCard $user_id=42 $show_email=true />

class UserCard extends Jqhtml_Component {
  on_ready() {
    console.log(this.args.user_id); // 42
    // Don't do: this.args.user_id = 99; ❌
  }
}
```

**`this.data`** - Loaded data (set only in `on_load()`):
```javascript
class UserCard extends Jqhtml_Component {
  async on_load() {
    // Only place to set this.data
    this.data = await fetch('/api/user/' + this.args.user_id).then(r => r.json());
  }

  on_ready() {
    // Don't do: this.data.name = 'New Name'; ❌
  }
}
```

**Other properties** - Component-specific state:
```javascript
class UserCard extends Jqhtml_Component {
  on_ready() {
    // Use other properties for mutable state
    this.is_expanded = false;
    this.retry_count = 0;

    this.$sid('toggle').on('click', () => {
      this.is_expanded = !this.is_expanded;
      this.$.toggleClass('expanded', this.is_expanded);
    });
  }
}
```

### Best Practices

1. **Keep `on_load()` deterministic** - Same args should always fetch same data
2. **Don't rely on `on_load()` being called** - Due to deduplication, it may not execute
3. **Use `this.data` only for loaded data** - Don't mix with component state
4. **Handle empty data gracefully** - Template should work even if `on_load()` hasn't run yet
5. **Use `reload()` to refresh** - Don't manually re-call `on_load()` (reload handles deduplication + caching automatically)

---

## Technical Details

### INVOCATION_KEY Generation

```javascript
// Pseudocode
function generate_invocation_key(component_name, args) {
  const sorted_args = JSON.stringify(args, Object.keys(args).sort());
  return `${component_name}::${sorted_args}`;
}
```

**Example:**
```javascript
// Component: UserCard
// Args: {user_id: 42, show_email: true}
// Key: "UserCard::{"show_email":true,"user_id":42}"
```

### Coordination State Structure

```javascript
{
  [INVOCATION_KEY]: {
    status: 'loading',              // 'loading' | 'completed' | 'failed'
    promise: Promise<void>,         // Leader's on_load() promise
    leader_data: any,               // Result after leader completes
    waiting: Component[]            // Queue of follower components
  }
}
```

### Integration Points

- **Lifecycle Manager:** Intercepts before `on_load()` execution
- **Load Coordinator:** Manages coordination state and promise resolution
- **Component:** Receives data from coordinator instead of executing `on_load()`

---

## Related Documentation

- **Component Lifecycle:** `docs/reference/14_lifecycle_complete_specification.md` - Full lifecycle including reload() behavior
- **Debugging Tools:** `docs/reference/09_debugging_tools.md` - Verbose mode and debugging
- **Error Handling:** `docs/internal/11-13-ON_LOAD_ERROR_HANDLING.md` (design phase)

## Skipping Revalidation with use_cached_data

**Status:** ✅ Implemented (v2.3.14+)

By default, JQHTML's caching uses a **stale-while-revalidate** pattern: cached data is displayed immediately, but `on_load()` always runs to fetch fresh data. This ensures data freshness.

In some scenarios, you may want to skip revalidation entirely and use cached data as-is:
- Performance-critical UIs where stale data is acceptable
- Offline-first applications
- Components displaying historical/archival data that rarely changes

### Enabling use_cached_data

Pass `use_cached_data: true` when creating a component:

```javascript
// Via jQuery plugin
$('#container').component('Product_Card', { product_id: 123, use_cached_data: true });
```

```jqhtml
<!-- Via template attribute -->
<Product_Card $product_id=123 $use_cached_data=true />
```

### Behavior

**When `use_cached_data: true` AND cache hit occurs:**
1. Cached data is loaded into `this.data` during `create()` phase
2. Component renders immediately with cached data
3. `on_load()` is **completely skipped**
4. Component proceeds directly to `on_ready()`

**When `use_cached_data: true` AND cache miss:**
- `on_load()` executes normally (no cache to use)
- Data is cached for future use
- Next instantiation with same args will hit cache

**When `use_cached_data: false` or not set:**
- Standard stale-while-revalidate behavior
- Cache is used for instant render, but `on_load()` always runs

### Automatic Child Propagation

When a parent component has `use_cached_data: true`, all child components rendered in its template automatically inherit this setting:

```jqhtml
<!-- Parent with use_cached_data=true -->
<Dashboard $use_cached_data=true>
  <!-- All children inherit use_cached_data=true automatically -->
  <User_Stats />
  <Recent_Activity />
  <Notifications />
</Dashboard>
```

This ensures consistent caching behavior throughout a component tree without manually passing the flag to each child.

### Cache Mode Restrictions

`use_cached_data` only applies to **data cache mode** (`'data'`).

In **HTML cache mode** (`'html'`), the flag has no effect and a console warning is shown:
```
[JQHTML] Component "..." has use_cached_data=true but cache mode is 'html'.
use_cached_data only applies to 'data' cache mode. The flag will be ignored.
```

### Cache Key Behavior

The `use_cached_data` flag is **excluded from cache key generation**. This means:

```javascript
// These share the same cache entry:
$('#a').component('Card', { id: 1 });                          // Cache key: Card::{"id":1}
$('#b').component('Card', { id: 1, use_cached_data: true });   // Cache key: Card::{"id":1}
```

Components with different `use_cached_data` values share cached data, which is the intended behavior.

### When to Use

**✅ Good use cases:**
- Dashboard widgets showing summary data (ok if slightly stale)
- Profile pages for viewing (not editing)
- Historical data displays
- Offline-capable features
- Performance-critical initial page loads

**❌ Avoid when:**
- Data freshness is critical (real-time data, financial info)
- User is about to edit the data (needs latest version)
- Component has no `on_load()` (flag has no effect)

### Example: Performance-Optimized Dashboard

```javascript
class Dashboard extends Jqhtml_Component {
  on_create() {
    // Enable data caching
    window.jqhtml.set_cache_key(`app_${BUILD_HASH}_user_${user_id}`, 'data');
  }

  async on_ready() {
    // Load dashboard with cached data (instant render, no revalidation)
    $('#main').component('Dashboard_Content', { use_cached_data: true });

    // User can manually refresh if they want fresh data
    this.$sid('refresh_btn').on('click', async () => {
      const dashboard = $('#main').component();
      await dashboard.reload();  // Forces on_load() to run
    });
  }
}
```

---

## Public API Summary

| API | Purpose |
|-----|---------|
| `jqhtml.set_cache_key(key, mode?)` | Enable caching with optional mode ('data' or 'html', default: 'data') |
| `jqhtml.get_cache_mode()` | Returns current cache mode ('data' or 'html') |
| `jqhtml.register_cache_class(Class)` | Register ES6 class for data mode serialization |
| `cache_id()` method | Override default cache key on a component |
| `use_cached_data: true` | Skip `on_load()` revalidation when cache hit (data mode only) |
| `jqhtml.debug.verbose = true` | Enable cache operation logging |

---

## Changelog

**v2.2.189** - Request deduplication implemented
- Automatic deduplication of identical component loads
- INVOCATION_KEY-based coordination
- Transparent to developers
- Immediate cleanup after dispatch

**v2.2.196** - Component caching implemented
- Automatic localStorage-backed caching
- Cache read in `create()` stage for instant first render
- Cache write in `load()` stage after `on_load()` completes
- Only cache non-empty data (`!== {}`)
- Stale-while-revalidate pattern (always revalidate via `on_load()`)

**v2.2.197** - Smart reload() with cache integration
- Args change detection via `_args_on_last_render` snapshot
- Cache read when args change for instant render
- Conditional rendering (only if cache miss OR data changed)
- Reuses `load()` for deduplication and cache write
- Optimized for dynamic filtering and pagination UIs

**v2.3.x** - Caching made opt-in with set_cache_key()
- Caching now disabled by default (safe default)
- Must call `jqhtml.set_cache_key()` to enable
- Cache key convention: include app build, user ID, session
- Automatic cache invalidation when key changes
- Added `cache_id()` method for custom cache keys
- Verbose mode logs cache operations

**v2.4.x** - Dual cache mode support
- Added `'data'` and `'html'` cache modes
- `set_cache_key(key, mode)` now accepts optional mode parameter
- `'data'` mode (default, recommended): Caches `this.data` with ES6 class serialization
- `'html'` mode: Caches rendered DOM innerHTML after children ready
- Added `jqhtml.register_cache_class(Class)` for ES6 class serialization
- Added `jqhtml.get_cache_mode()` to check current mode
- HTML mode snapshot timing: after `_wait_for_children_ready()`, before `on_ready()`
- **Hot/cold cache parity (data mode)**: Normalizes `this.data` after `on_load()` via serialize/deserialize round-trip, ensuring fresh data behaves identically to cached data (catches missing class registrations during development)

**v2.5.x** - HTML cache architecture improvements
- Removed `on_render()` proxy restriction in HTML mode - `this.data` now fully accessible
- Added `_is_dynamic` flag to track if component modifies `this.data` in `on_load()`
- Static components (no data changes) skip HTML caching entirely
- Added `_wait_for_children_on_render()` synchronization for proper child render completion
- Added `_on_render_complete` flag for parent/child synchronization
- HTML snapshot now taken after children's `on_render()` completes (not just ready state)
- Improved hot/cold parity: forced re-render after cache restore ensures `this.data` availability

---

## Preloading with Lifecycle Flags

JQHTML provides lifecycle truncation flags for preloading scenarios — instantiating components to warm the data cache without firing DOM-interaction hooks.

### `_load_only`

Runs `on_create()` + `on_load()` only. No render, no children created.

```javascript
$('<div>').component('Product_List', { category: 'electronics', _load_only: true });
```

After this call, the cache contains `Product_List`'s data for `category=electronics`. When the user navigates to that view and a normal `Product_List` is created with the same args, the cached data provides an instant first render.

### `_load_render_only`

Runs `on_create()` + render + `on_load()` + re-render. Children are created and their `on_load()` fires too. All DOM-interaction hooks (`on_render`, `on_loaded`, `on_ready`) are suppressed across the entire tree.

```javascript
$('<div>').component('Dashboard_Page', { user_id: 123, _load_render_only: true });
```

This warms the cache for the entire component tree — parent, children, grandchildren. Every component's `on_load()` fires, populating cache entries for the full page.

### Cache Integration

Both flags work naturally with the caching system:

1. Components boot with truncated lifecycle
2. `on_load()` fires and populates `this.data`
3. Framework writes `this.data` to cache (same as normal boot)
4. When user navigates to the actual page, normal components find cache hits and render instantly

### Flag Cascading

Both flags cascade from parent to children automatically. A child can opt out by explicitly setting the flag to `false`.
