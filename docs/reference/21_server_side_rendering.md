# Server-Side Rendering

**Version:** 2.3.54+

JQHTML has two distinct server-side subsystems that are frequently confused:

| Subsystem | What it does | Where it runs | Doc |
|---|---|---|---|
| `boot()` | Hydrates placeholders a backend emitted by hand into live components | Client | `18_boot.md` |
| `@jqhtml/ssr` | Renders real component HTML by running the actual lifecycle in jsdom | Server (Node) | this doc |

They compose: `@jqhtml/ssr` produces the HTML, and the client hydrates it. This document
covers the render server, the wire protocol, and the preload API that keeps hydration from
re-fetching everything the server already fetched.

---

## Architecture

`@jqhtml/ssr` is a long-running Node process, not a per-request script. A backend talks to it
over newline-delimited JSON on TCP or a Unix socket.

```
Backend  ──JSON line──>  SSR server (persistent Node process)
                           1. Load bundles into an isolated jsdom environment (LRU cached)
                           2. Run the real component lifecycle, including real fetch()
                           3. Wait for on_ready
                           4. Return HTML + a dump of localStorage/sessionStorage
Backend  <──JSON line──
```

The properties that matter when reasoning about it:

- **Real data fetching.** Components issue actual HTTP requests during SSR. There is no
  mocking layer — `on_load()` runs exactly as it does in a browser.
- **Request isolation.** Every render gets a fresh jsdom environment. Bundle *code* is
  cached (LRU); bundle *state* is not shared between requests.
- **URL rewriting.** Relative URLs resolve against `options.baseUrl`.
- **Cache export.** The server returns its storage state so the client can start warm.

Unix sockets outperform TCP and should be preferred when the backend is on the same host.

---

## Request Types

Full payload shapes live in `packages/ssr/README.md`. Summarized:

| Type | Purpose |
|---|---|
| `ping` | Liveness check |
| `render` | Render ONE named component with args to an HTML string |
| `render_spa` | Boot a full SPA bundle set, dispatch a URL through the app's router, render the resulting page |
| `flush_cache` | Evict cached bundle code |

**`render`** is for SEO fallbacks, emails, and previews — anywhere you need the markup for a
single known component. Requires `bundles`, `component`, and `options.baseUrl`.

**`render_spa`** is full-page SSR for SPA frameworks built on JQHTML (added in v2.3.36 for
RSpade-style integrations). Requires `bundles`, `url`, `rsxapp`, and `options.baseUrl`. Two
options are worth calling out because they are the usual source of "SSR returns an empty
page" reports:

- `options.ready_selector` — the CSS selector polled to decide the SPA has finished mounting.
  Defaults to `#spa-root > *:first-child`. If the app mounts somewhere else, SSR times out
  waiting for something that will never appear.
- `options.extract_meta` — pulls `<title>` and meta tags into the response's `meta` field.
  Off by default, so a caller that needs SEO tags must ask for them.

---

## The Preload API

### The problem it solves

Without preload, data is fetched twice:

```
SSR: on_load() fetches /api/user/42  ──>  HTML rendered
Client: boots, on_load() fetches /api/user/42 again  ──>  same data, wasted round-trip
```

The preload API captures what the server fetched and replays it on the client, so hydration
skips `on_load()` entirely for components whose data is already known.

### Server side: capture

```javascript
jqhtml.start_data_capture();   // idempotent
// ... render ...
const entries = jqhtml.get_captured_data();   // one-shot: clears the buffer
jqhtml.stop_data_capture();    // stops capture and clears all capture state
```

Capture hooks in at `_apply_load_result()`, immediately after `this.data` is refrozen. Two
conditions gate it, and both surprise people:

- **Only components with a custom `on_load()` are captured.** A component that never loads
  anything has nothing worth replaying.
- **Capture records the component's `cache_key`**, which is what the client later matches on.

### Client side: replay

```javascript
jqhtml.set_preload_data(entries);   // MUST run before any component _load() begins
await jqhtml.boot();
jqhtml.clear_preload_data();        // discard whatever went unconsumed
```

`set_preload_data(null)` and an empty array are both no-ops, so an integration can call it
unconditionally.

### Lookup is keyed by cache_key — with a consequence

In `_load()`, the preload check is:

```javascript
if (cache_key !== null && has_preload_data()) {
  const preloaded_data = consume_preload_data(cache_key);
  ...
}
```

**A component whose args decline serialization has a `null` cache key and can therefore never
consume preloaded data.** It will re-fetch on the client no matter what the server captured.
This ties preload directly to the keyable-args rules in `15_deduplication_and_caching.md`: a
callback or class instance in the args costs you cache reuse, load deduplication, *and* SSR
preload. When a component must take such an arg, `cache_id()` restores all three at once.

Consumption is **one-shot** — `consume_preload_data()` removes the entry it returns. Two
identical components on the page do not both consume the same entry; the second falls through
to a normal load (and to deduplication, if it qualifies).

### Complete API

| Function | Side | Notes |
|---|---|---|
| `start_data_capture()` | server | Idempotent |
| `get_captured_data()` | server | One-shot; returns `PreloadEntry[]` and clears the buffer |
| `stop_data_capture()` | server | Stops capture, clears all state |
| `is_capture_enabled()` | both | Predicate; also suppresses `gate_load()` (see below) |
| `set_preload_data(entries)` | client | Must precede any `_load()`; null/empty is a no-op |
| `consume_preload_data(cache_key)` | internal | One-shot lookup from `_load()` |
| `has_preload_data()` | internal | Fast early exit in `_load()` |
| `clear_preload_data()` | client | Discards unconsumed entries after hydration |

```typescript
interface PreloadEntry {
  component: string;
  args: Record<string, any>;
  data: Record<string, any>;
}
```

Source: `packages/core/src/preload-data.ts`.

---

## Interactions With the Rest of the Framework

**`gate_load()` is suppressed during capture.** `_await_load_gates()` returns `null` when
`is_capture_enabled()` is true — the server cannot await arbitrary client promises, so gates
are skipped rather than hung on. See `14_lifecycle_complete_specification.md`.

**Debug output.** With `jqhtml.debug.verbose` enabled, a preload hit logs
`[SSR Preload] Component <cid> (<Name>) using preloaded data` with the cache key. This is the
fastest way to confirm preload is actually working rather than silently missing.

**Deduplication still applies.** Preload misses fall through to the normal load path, so
several components that miss preload but share an invocation key still collapse into one
request.

---

## Related Documentation

- `18_boot.md` — client-side hydration of server-emitted placeholders
- `15_deduplication_and_caching.md` — cache keys, the keyable-arg rules preload depends on
- `14_lifecycle_complete_specification.md` — where load, gates, and `_apply_load_result()` sit
- `packages/ssr/README.md` — protocol payload shapes, CLI, server options, error codes
- `packages/ssr/INTEGRATION_GUIDE.md` — backend integration walkthrough
