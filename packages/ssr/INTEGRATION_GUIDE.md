# @jqhtml/ssr Integration Guide

Guide for integrating the JQHTML SSR service with external SPA frameworks. Written for framework developers (e.g., rspade) who want server-side rendering for SEO on public pages.

---

## Overview

The `@jqhtml/ssr` package is a long-running Node.js service that renders JQHTML components and SPA pages inside a jsdom + jQuery environment. It accepts requests via TCP or Unix socket using a newline-delimited JSON protocol.

**What the SSR service provides:**
- Isolated jsdom environment per request (no state leakage)
- jQuery integration with `$.fn.component()` plugin
- `$.ajax()` transport that makes **real HTTP requests** via Node's `fetch()`
- `window.rsxapp` injection from request payload
- SSR token header injection on all outgoing HTTP requests
- Bundle caching (LRU) with filesystem loading support
- Page metadata extraction (title, description, og:image)
- Configurable timeouts and ready detection

**What your framework must provide:**
- SPA auto-boot when `window.rsxapp.is_spa === true`
- Route dispatch based on `window.location.pathname`
- Components rendered into `#spa-root` (or configurable selector)
- Standard jqhtml component lifecycle with `.ready()` promise
- Backend endpoints that serve data without auth when `X-SSR-Token` header is present
- Client-side hydration logic (detect `__SSR_HYDRATE__`, hot-swap)

---

## Installation

```bash
npm install @jqhtml/ssr

# Or add to package.json
"dependencies": {
  "@jqhtml/ssr": "^2.3.36"
}
```

---

## Starting the Service

```bash
# TCP (development)
jqhtml-ssr --tcp 9876

# Unix socket (production - same machine)
jqhtml-ssr --socket /tmp/jqhtml-ssr.sock

# With options
jqhtml-ssr --tcp 9876 --max-bundles 20 --timeout 15000
```

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--tcp <port>` | - | Listen on TCP port |
| `--socket <path>` | - | Listen on Unix socket |
| `--max-bundles <n>` | 10 | Max cached bundle sets (LRU) |
| `--timeout <ms>` | 30000 | Default render timeout |

---

## Protocol Reference

All communication uses newline-delimited JSON. Send a request followed by `\n`, receive a response followed by `\n`.

### Request Types

| Type | Description |
|------|-------------|
| `render` | Render a single jqhtml component |
| `render_spa` | Boot SPA framework, dispatch to URL, render full page |
| `ping` | Health check |
| `flush_cache` | Clear bundle cache |

### render_spa Request

This is the primary request type for SPA integration.

```json
{
  "id": "unique-request-id",
  "type": "render_spa",
  "payload": {
    "bundles": [
      { "id": "vendor", "path": "/absolute/path/to/vendor.js" },
      { "id": "app", "path": "/absolute/path/to/app.js" }
    ],
    "url": "/properties/123",
    "rsxapp": {
      "is_spa": true,
      "is_auth": false,
      "user": null,
      "site": { "id": 1, "name": "MySite", "domain": "example.com" },
      "csrf": null,
      "params": {},
      "build_key": "abc123",
      "debug": false,
      "ajax_batching": true,
      "server_time": "2026-02-20T12:00:00Z",
      "user_timezone": "America/Chicago"
    },
    "options": {
      "baseUrl": "http://localhost:8080",
      "timeout": 15000,
      "ssr_token": "shared-secret-token",
      "extract_meta": true,
      "ready_selector": "#spa-root > *:first-child"
    }
  }
}
```

**Payload fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bundles` | array | Yes | JS bundles to execute. Each has `id` (string) and either `path` (filesystem) or `content` (inline JS) |
| `url` | string | Yes | URL path to render (e.g., `/properties/123`) |
| `rsxapp` | object | Yes | Bootstrap data injected as `window.rsxapp` before bundle execution |
| `options.baseUrl` | string | Yes | Base URL for resolving relative HTTP requests and setting jsdom URL |
| `options.timeout` | number | No | Render timeout in ms (default: server default, usually 30000) |
| `options.ssr_token` | string | No | Token included as `X-SSR-Token` header on all outgoing requests |
| `options.extract_meta` | boolean | No | Extract title/description/og:image from rendered DOM (default: false) |
| `options.ready_selector` | string | No | CSS selector to find root component (default: `#spa-root > *:first-child`) |

### render_spa Response

```json
{
  "id": "unique-request-id",
  "status": "success",
  "payload": {
    "html": "<div class='Layout Component'>...rendered page...</div>",
    "meta": {
      "title": "Page Title",
      "description": "Page description",
      "og_image": "https://cdn.example.com/image.jpg"
    },
    "cache": {
      "localStorage": {},
      "sessionStorage": {}
    },
    "timing": {
      "total_ms": 340,
      "bundle_load_ms": 12,
      "render_ms": 328
    }
  }
}
```

### Error Response

```json
{
  "id": "unique-request-id",
  "status": "error",
  "error": {
    "code": "RENDER_TIMEOUT",
    "message": "SPA render exceeded 15000ms timeout",
    "stack": "..."
  }
}
```

**Error codes:**

| Code | Description |
|------|-------------|
| `PARSE_ERROR` | Invalid request JSON or missing required fields |
| `BUNDLE_LOAD_ERROR` | Bundle file not found on filesystem |
| `BUNDLE_ERROR` | Bundle JS failed to parse or execute |
| `SPA_BOOT_ERROR` | SPA framework failed to initialize |
| `RENDER_ERROR` | Component threw during lifecycle |
| `RENDER_TIMEOUT` | Page did not reach ready state within timeout |
| `ROUTE_NOT_FOUND` | No component found on ready_selector |
| `DATA_FETCH_ERROR` | on_load() HTTP request(s) failed |

---

## Bundle Requirements

Your JS bundles must satisfy these requirements for SSR to work:

### 1. Auto-boot on `rsxapp.is_spa`

When `window.rsxapp.is_spa === true`, the SPA framework should automatically:
1. Initialize the router
2. Discover all route-action mappings
3. Dispatch to `window.location.pathname`

The SSR service sets `window.rsxapp` from the request payload BEFORE executing bundles, and sets the jsdom URL to `baseUrl + url`. So when your bundle reads `window.rsxapp.is_spa` it will be `true`, and `window.location.pathname` will match the requested URL.

### 2. Render into `#spa-root`

The dispatched page must render into `#spa-root` (or the selector specified in `ready_selector`). The SSR service polls for a jqhtml component on this selector and calls `.ready()` on it.

If your framework uses a different root element, specify `ready_selector` in the request options.

### 3. Standard jqhtml lifecycle

Components must use the standard jqhtml lifecycle (create → render → on_load → on_ready) and expose a `.ready()` promise. The SSR service waits for the root component's `.ready()` to resolve, which (due to jqhtml's bottom-up ready ordering) ensures all children are also ready.

### 4. No browser-only APIs

Components rendered via SSR should avoid:
- `window.alert()`, `window.confirm()`, `window.prompt()`
- `window.open()`, `window.close()`
- CSS animations / transitions (jsdom doesn't compute styles)
- Canvas / WebGL / WebAudio
- Geolocation, WebRTC, etc.

Components can detect SSR mode via `window.__SSR__` or `window.__JQHTML_SSR_MODE__`:

```javascript
on_ready() {
  if (window.__SSR__) return; // Skip browser-only setup
  this.$.on('click', '.button', () => this.handle_click());
}
```

---

## Data Fetching

### How it works

The SSR service registers a custom jQuery `$.ajaxTransport` that routes all `$.ajax()` calls through Node's native `fetch()` API. This means:

```
Your code:        $.ajax({ url: '/api/data', ... })
jQuery internals: $.ajaxTransport → send()
SSR transport:    Node fetch('http://baseUrl/api/data', ...)
Network:          Real HTTP request to your backend
```

**Key behaviors:**
- Relative URLs are resolved against `options.baseUrl`
- `Authorization` and `Cookie` headers are automatically stripped (SSR is for public pages)
- If `ssr_token` is configured, `X-SSR-Token` header is added to every outgoing request
- The transport supports GET, POST, PUT, DELETE, etc.
- JSON content type is preserved

### What your backend must handle

For SSR data fetching to work, your backend must serve responses without session authentication when the SSR service calls endpoints. Two approaches:

#### Option A: SSR Token (Recommended)

Configure a shared secret between your backend and the SSR service:

```json
"options": { "ssr_token": "your-shared-secret" }
```

The SSR service includes this as `X-SSR-Token` on all outgoing requests. Your backend middleware checks for this header and bypasses session auth:

```php
// PHP middleware example
class SSR_Token_Middleware
{
    public function handle(Request $request, Closure $next)
    {
        $ssr_token = $request->header('X-SSR-Token');
        if ($ssr_token && $ssr_token === config('ssr.token')) {
            // Mark as SSR request - bypass session auth for read-only endpoints
            $request->attributes->set('is_ssr_request', true);
        }
        return $next($request);
    }
}
```

#### Option B: Public Endpoints

If your endpoints already have public variants that don't require auth, components using `@ssr` should call those endpoints in their `on_load()`.

---

## SSR Token Authentication

When `ssr_token` is set in the request options, it is injected into:

1. **`$.ajax()` requests** - via the custom ajaxTransport
2. **`fetch()` requests** - via the fetch wrapper
3. **`XMLHttpRequest` requests** - via the XHR wrapper

The header name is `X-SSR-Token`. Your backend should:
- Check for this header on Ajax/API endpoints
- Validate it against a configured secret
- Allow the request through without session cookies
- Only serve public/read-only data (never write operations)

---

## Meta Extraction

When `extract_meta: true`, the SSR service extracts metadata from the rendered page:

| Field | Source | Priority |
|-------|--------|----------|
| `title` | 1. `component.page_title()` method, 2. `document.title` | Method first, then DOM |
| `description` | 1. `<meta name="description">`, 2. `<meta property="og:description">` | DOM |
| `og_image` | `<meta property="og:image">` | DOM |

Your framework should set these during rendering:

```javascript
// In your page action/component
on_ready() {
  document.title = this.data.property.title + ' - MySite';

  // Or via a method
  page_title() {
    return this.data.property.title + ' - MySite';
  }
}
```

For meta tags, add them to `<head>` during rendering:

```javascript
on_ready() {
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'description');
  meta.setAttribute('content', this.data.property.description);
  document.head.appendChild(meta);
}
```

---

## Client-Side Hydration

When the browser loads an SSR-rendered page, the SPA framework must "hydrate" - replace the pre-rendered HTML with a fully interactive version.

### Recommended: Hot-Swap Pattern

The SSR service sets `window.__SSR_HYDRATE__ = true` in the environment. Your backend should include this flag in the served HTML page:

```html
<script>
  window.__SSR_HYDRATE__ = true;
  window.rsxapp = { is_spa: true, is_auth: false, ... };
</script>
```

When the SPA framework boots in the browser and detects this flag:

```javascript
// In your SPA initialization
if (window.__SSR_HYDRATE__) {
  // 1. Match URL to action (same as normal dispatch)
  const route = this.match_url(window.location.pathname);

  // 2. Create component on a DETACHED element (invisible)
  const $detached = $('<div>');
  $detached.component(route.action_class, route.args);
  const component = $detached.component();

  // 3. Wait for the detached component to be fully ready
  //    (fetches fresh data, attaches event handlers)
  await component.ready();

  // 4. Hot-swap: replace pre-rendered DOM with live component
  $('#spa-root').empty().append(component.$);

  // 5. Clear flag
  delete window.__SSR_HYDRATE__;
}
```

### Why hot-swap instead of true hydration?

True hydration (walking existing DOM, attaching event listeners) is fragile - any mismatch between server and client render causes failures. Hot-swap is robust:

1. User sees pre-rendered HTML immediately (SEO, fast perceived load)
2. JS loads, component renders on detached element (invisible)
3. When ready, detached element swaps in (same data = identical HTML = no flicker)
4. If data changed since SSR, user gets fresh content (graceful)

The swap is a single DOM operation, so there's no visible flicker.

---

## Error Handling & Fallback

### SSR service errors

If the SSR service returns an error or is unavailable, your middleware should fall back to the normal SPA shell (empty `#spa-root`, JS loads and renders client-side):

```php
try {
    $result = $ssr_client->render_spa($url, $bundles, $rsxapp);
} catch (SSR_Exception $e) {
    // Log error for monitoring
    Log::warning('SSR failed, falling back to SPA', [
        'url' => $url,
        'error' => $e->getMessage()
    ]);
    // Return normal SPA page (no pre-rendered content)
    return $this->render_spa_shell($request);
}
```

### Timeout tuning

Different pages may need different timeouts:
- Simple static pages: 2-5 seconds
- Pages with data fetching: 5-15 seconds
- Heavy pages with multiple API calls: 15-30 seconds

Set per-request via `options.timeout`.

### Connection failures

The SSR service uses TCP or Unix sockets. If the service is down:
- TCP: Connection refused error
- Unix: Socket file not found error

Always wrap SSR calls in try/catch with fallback to normal SPA rendering.

---

## PHP Client Example

Complete PHP class for communicating with the SSR service:

```php
class Jqhtml_SSR_Client
{
    private string $socket_path;
    private int $default_timeout;
    private string $ssr_token;

    public function __construct(
        string $socket_path = '/tmp/jqhtml-ssr.sock',
        int $default_timeout = 15000,
        string $ssr_token = ''
    ) {
        $this->socket_path = $socket_path;
        $this->default_timeout = $default_timeout;
        $this->ssr_token = $ssr_token;
    }

    /**
     * Render a SPA page via the SSR service
     *
     * @param string $url URL path to render (e.g., "/properties/123")
     * @param array $bundles Bundle definitions [["id" => "...", "path" => "..."], ...]
     * @param array $rsxapp Bootstrap data for window.rsxapp
     * @param int|null $timeout Override timeout in ms
     * @return array { html, meta, cache, timing }
     * @throws SSR_Exception
     */
    public function render_spa(
        string $url,
        array $bundles,
        array $rsxapp,
        ?int $timeout = null
    ): array {
        $socket = stream_socket_client(
            "unix://{$this->socket_path}",
            $errno, $errstr, 5
        );

        if (!$socket) {
            throw new SSR_Exception("SSR connection failed: {$errstr} ({$errno})");
        }

        $request = json_encode([
            'id' => uniqid('ssr-'),
            'type' => 'render_spa',
            'payload' => [
                'bundles' => $bundles,
                'url' => $url,
                'rsxapp' => $rsxapp,
                'options' => [
                    'baseUrl' => config('app.url'),
                    'timeout' => $timeout ?? $this->default_timeout,
                    'ssr_token' => $this->ssr_token,
                    'extract_meta' => true,
                ],
            ],
        ]) . "\n";

        // Set socket read timeout (render timeout + 5s buffer)
        $timeout_secs = (int) ceil(($timeout ?? $this->default_timeout) / 1000) + 5;
        stream_set_timeout($socket, $timeout_secs);

        fwrite($socket, $request);
        $response = fgets($socket);
        fclose($socket);

        if (!$response) {
            throw new SSR_Exception('SSR service returned empty response');
        }

        $data = json_decode($response, true);

        if ($data['status'] !== 'success') {
            throw new SSR_Exception(
                'SSR render failed: ' . ($data['error']['message'] ?? 'Unknown error'),
                0, null,
                $data['error']['code'] ?? 'UNKNOWN'
            );
        }

        return $data['payload'];
    }

    /**
     * Ping the SSR service
     * @return array { uptime_ms }
     */
    public function ping(): array
    {
        $socket = stream_socket_client(
            "unix://{$this->socket_path}",
            $errno, $errstr, 2
        );

        if (!$socket) {
            throw new SSR_Exception("SSR connection failed: {$errstr}");
        }

        $request = json_encode([
            'id' => uniqid('ping-'),
            'type' => 'ping',
            'payload' => new \stdClass(),
        ]) . "\n";

        stream_set_timeout($socket, 5);
        fwrite($socket, $request);
        $response = fgets($socket);
        fclose($socket);

        $data = json_decode($response, true);
        return $data['payload'] ?? [];
    }

    /**
     * Flush the bundle cache
     * @param string|null $bundle_id Flush specific bundle, or null for all
     */
    public function flush_cache(?string $bundle_id = null): void
    {
        $socket = stream_socket_client(
            "unix://{$this->socket_path}",
            $errno, $errstr, 2
        );

        if (!$socket) return;

        $payload = $bundle_id ? ['bundle_id' => $bundle_id] : new \stdClass();

        $request = json_encode([
            'id' => uniqid('flush-'),
            'type' => 'flush_cache',
            'payload' => $payload,
        ]) . "\n";

        stream_set_timeout($socket, 5);
        fwrite($socket, $request);
        fgets($socket);
        fclose($socket);
    }
}
```

---

## Configuration Reference

### Request Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | string | **required** | Base URL for HTTP requests and jsdom URL |
| `timeout` | number | 30000 | Max render time in ms |
| `ssr_token` | string | null | Token added as `X-SSR-Token` header on outgoing requests |
| `extract_meta` | boolean | false | Extract title/description/og:image from rendered page |
| `ready_selector` | string | `#spa-root > *:first-child` | CSS selector for root component to wait on |

### Server Options (CLI)

| Flag | Default | Description |
|------|---------|-------------|
| `--tcp <port>` | - | Listen on TCP port |
| `--socket <path>` | - | Listen on Unix socket path |
| `--max-bundles <n>` | 10 | Maximum bundle sets in LRU cache |
| `--timeout <ms>` | 30000 | Default render timeout |

### Environment Globals

These globals are set in the SSR jsdom environment:

| Global | Value | Description |
|--------|-------|-------------|
| `window.__SSR__` | `true` | SSR mode flag |
| `window.__JQHTML_SSR_MODE__` | `true` | JQHTML-specific SSR flag |
| `window.__SSR_HYDRATE__` | `true` | Hydration flag for client |
| `window.rsxapp` | object | Bootstrap data from request |
| `window.$` / `window.jQuery` | jQuery | jQuery bound to jsdom window |
| `window.fetch` | function | URL-rewriting fetch with SSR token |

---

## Architecture Summary

```
Client Request (GET /properties/123, no auth cookie)
    │
    ▼
Your Backend Middleware
    ├─ Is authenticated? → No
    ├─ Is route SSR-enabled? → Yes
    ├─ Is SSR cached? → Check cache
    │   ├─ Cache HIT → Return cached HTML
    │   └─ Cache MISS ──┐
    │                    ▼
    │   SSR Service (Node.js, @jqhtml/ssr)
    │   ├─ Create jsdom + jQuery environment
    │   ├─ Set window.rsxapp from request
    │   ├─ Install $.ajaxTransport (real HTTP)
    │   ├─ Load & execute JS bundles
    │   ├─ SPA auto-boots → dispatches to URL
    │   ├─ Components run on_load() → $.ajax() → real HTTP to your backend
    │   │   └─ Backend checks X-SSR-Token → serves public data
    │   ├─ Wait for ready() (all children done)
    │   ├─ Extract HTML from #spa-root
    │   ├─ Extract meta (title, description, og:image)
    │   └─ Return { html, meta, cache, timing }
    │                    │
    │   ◄────────────────┘
    ├─ Build full HTML page:
    │   ├─ <head>: meta tags from SSR
    │   ├─ <head>: __SSR_HYDRATE__ = true
    │   ├─ <head>: CSS + JS bundles (deferred)
    │   └─ <body>: #spa-root with SSR HTML
    ├─ Cache result
    └─ Return to browser

Browser receives pre-rendered page
    ├─ User sees content immediately (SEO ✓)
    ├─ JS bundles load (deferred)
    ├─ SPA boots, detects __SSR_HYDRATE__
    ├─ Creates components on detached element
    ├─ Waits for ready (fresh data fetched)
    ├─ Hot-swaps into DOM (no flicker)
    └─ Page is fully interactive
```
