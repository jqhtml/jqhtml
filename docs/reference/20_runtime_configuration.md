# Runtime Configuration

Integration-level settings supplied by the **host application** when jqhtml is loaded.

This is distinct from `jqhtml.debug`. `jqhtml.debug` is a developer's interactive tracing
switch, flipped by hand in a console to watch a lifecycle. Runtime configuration describes
the **environment the application is running in**, is set once at startup by the framework
or bundle entry point, and jqhtml derives behaviour from it.

---

## Setting configuration

Two equivalent entry points. Use whichever fits the integration.

```javascript
import jqhtml from '@jqhtml/core';
import $ from 'jquery';

// At initialization - preferred, since it applies before the first render
jqhtml.init($, { mode: 'production' });

// Or independently, any time before components boot
jqhtml.configure({ mode: 'production' });
```

`init(jQuery, config?)` forwards its second argument to `configure()`. The `config`
argument is optional; `init($)` on its own is unchanged and still valid.

`configure()` merges. Repeated calls accumulate rather than reset.

---

## Options

```typescript
interface Jqhtml_Config {
  mode?: 'development' | 'production';
  warn_uncacheable_args?: boolean;
  debug_attributes?: boolean;
}
```

### `mode`

The environment the host app is running in. Setting it resets every other flag to that
mode's defaults. **Defaults to `'development'`** — an integration that passes no config
keeps every diagnostic, and production behaviour is always opt-in.

An unrecognised mode throws immediately rather than silently doing nothing.

| Flag | `development` | `production` |
|------|---------------|--------------|
| `warn_uncacheable_args` | `true` | `false` |
| `debug_attributes` | `true` | `false` |

### `warn_uncacheable_args`

Warns when a component that fetches data is invoked with arguments that cannot be reduced
to a cache key, **and** defines no `cache_id()` to supply its identity another way.

jqhtml builds a component's cache key from its name plus its arguments. Primitives and
plain data (objects/arrays of primitives, nested freely) serialize; a function, class
instance, DOM node, circular structure or oversized value does not. Nothing breaks — the
component renders and loads normally — but it silently opts out of being restored from cache
when reused. See `15_deduplication_and_caching.md` for the full keyable set.

The warning names the offending argument, explains what was lost, recommends `cache_id()`,
and gives a DevTools selector for locating the affected elements. The `data-nocache` attribute
is `"<arg>:<reason>"` — e.g. `data-nocache="on_select:function"`, `"rows:circular"`,
`"$el:dom-node"`:

```
[JQHTML] <Product_List> was given a non-serializable arg $filters (object), so jqhtml
cannot build a cache key for it.
  The component works, but it opts out of two features: it will not be restored from
  cache when reused, and simultaneous instances with the same args will each run
  on_load() instead of sharing one request.
  Fix: define cache_id() on the component to state its identity explicitly, e.g.
    cache_id() { return `product_list_${this.args.some_id}`; }
  Or pass primitives instead of $filters.
  Find it in DevTools with the selector [data-nocache="filters"].
```

It fires **once per component name + argument**, so a list of fifty rows produces one
warning, not fifty. A component defining a working `cache_id()` is never warned about. A
component whose `cache_id()` throws gets a different message naming that as the fault.

Only components with a custom `on_load()` are checked — a component that fetches nothing
has nothing to cache, so warning about it would be noise.

### `debug_attributes`

Controls emission of DOM attributes that exist purely for developer legibility.

Currently one: **`data-sid`**. A `$sid="save_btn"` in a template compiles to
`id="save_btn:<cid>"` *and* `data-sid="save_btn"`. The scoped `id` is the functional one —
`$sid()` resolves through `document.getElementById`, never through `data-sid`. The
`data-sid` mirror exists so the un-scoped name is readable in DevTools.

With `debug_attributes: false`, `data-sid` is not emitted on components, on plain elements,
or via attribute application. `$sid()`, `sid()`, and every scoped lookup continue to work
unchanged, because they were never reading it.

`data-cid` on a rendered component is suppressed the same way. It mirrors the component's
`_cid` so component boundaries are legible in DevTools, and the runtime never reads it —
scoping uses the `_cid` property. Suppressing it changes nothing functional.

**One `data-cid` is NOT suppressed, and must never be.** While generating HTML the
instruction processor stamps a *transient* `data-cid` onto each component placeholder so it
can correlate the injected node with that component's JS-side data
(`instruction-processor.ts:308`), matches it with `querySelector` and removes it immediately
(`:137-140`). That value is a different id from the component's own `_cid`, it exists for
microseconds during rendering, and suppressing it would stop nested components booting
entirely. Plain elements use `data-tid` the same way.

Do not write selectors against `data-sid` or `data-cid`. Both are debug mirrors, both are
absent in production, and the jQuery layer already rejects `[data-sid=...]` selectors.

---

## Reading configuration

```javascript
jqhtml.get_config();
// { mode: 'development', warn_uncacheable_args: true, debug_attributes: true }
```

---

## Overriding individual flags

A flag passed alongside `mode` wins over that mode's default:

```javascript
// Production, but keep data-sid for debugging a staging deployment
jqhtml.configure({ mode: 'production', debug_attributes: true });
```

A call with flags but no `mode` leaves the current mode alone and applies just those flags:

```javascript
jqhtml.configure({ warn_uncacheable_args: true });
```

---

## Integration guidance

Pass the host application's own environment through. In a bundled app the value is usually
known at build time:

```javascript
// webpack / vite - NODE_ENV is inlined by the bundler
jqhtml.init($, { mode: process.env.NODE_ENV === 'production' ? 'production' : 'development' });
```

Server-rendered applications should emit the value with the page rather than infer it:

```blade
<script>
  window.jqhtml.init(window.jQuery, { mode: @json(app()->environment('production') ? 'production' : 'development') });
</script>
```

Configure **before** components boot. `jqhtml.boot()` and any `$(el).component(...)` call
render immediately, and `debug_attributes` is read during rendering — a component already
rendered does not retroactively lose its `data-sid`.

---

## Adding a new convention

Add the flag to `Jqhtml_Config` and to both rows of `MODE_DEFAULTS` in
`packages/core/src/config.ts`, export an accessor beside
`debug_attributes_enabled()` / `warn_uncacheable_args_enabled()`, and read that accessor at
the call site. Mode defaults live in one table on purpose: call sites ask "is this enabled",
never "what mode are we in".

---

## Source

`packages/core/src/config.ts` — configuration state and accessors
`packages/core/src/instruction-processor.ts` — `data-sid` emission points
`packages/core/src/component-cache.ts` — uncacheable-args warning
`tests/integration_config_modes/` — behavioural test, 27 assertions
