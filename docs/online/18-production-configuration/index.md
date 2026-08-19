# Production & Configuration

JQHTML behaves slightly differently depending on whether your application is running in
development or production. You tell it which by passing configuration when the framework
loads.

## Setting the mode

```javascript
import jqhtml from '@jqhtml/core';
import $ from 'jquery';

jqhtml.init($, { mode: 'production' });
```

`init()` takes the configuration as an optional second argument. You can also set it
separately, any time before components start rendering:

```javascript
jqhtml.configure({ mode: 'production' });
```

**The default is `development`.** An application that passes nothing keeps every diagnostic,
and production behaviour is always opt-in. Read back the resolved settings with
`jqhtml.get_config()`.

## What the mode changes

| | `development` | `production` |
|---|---|---|
| `warn_uncacheable_args` | on | off |
| `debug_attributes` | on | off |

### warn_uncacheable_args

Warns in the console when a component that loads data is given an argument that cannot be
used as a cache key, and has no `cache_id()` to supply its identity another way. The
component still works — it just quietly loses caching, which is easy to miss.

```
[JQHTML] <RowsList> cannot be cached: arg $params is not keyable because it contains a
function - a callback is real identity that content cannot express.
  The component works, but it will not be restored from cache when reused.
  Fix: define cache_id() on the component to state its identity explicitly, e.g.
    cache_id() { return `rowslist_${this.args.some_id}`; }
  Or pass plain data (objects/arrays of primitives are keyed automatically) instead of $params.
  Find it in DevTools with the selector [data-nocache="params:function"].
```

It fires once per component and argument, so a list of fifty rows produces one warning rather
than fifty. See [Caching & Performance](../14-caching-and-performance/) for which arguments
can be keyed.

### debug_attributes

JQHTML renders two attributes purely so you can read the DOM in DevTools:

- `data-sid` — mirrors the scoped `id="<sid>:<cid>"` that `$sid()` resolves against
- `data-cid` — mirrors the component's internal id, marking component boundaries

Neither is read by the framework, so production drops both:

```html
<!-- development -->
<div class="UserCard Component" data-cid="c123">
  <h3 id="title:c123" data-sid="title">Ada</h3>
</div>

<!-- production -->
<div class="UserCard Component">
  <h3 id="title:c123">Ada</h3>
</div>
```

The scoped `id` remains in both, and `$sid()`, `sid()` and every scoped lookup work
identically. Because these attributes disappear, **never write selectors against them** —
use `this.$sid('title')` and `this.sid('child')`.

If you need to inspect a production page, turn the attributes back on without leaving
production mode:

```javascript
jqhtml.configure({ mode: 'production', debug_attributes: true });
```

## Overriding individual settings

A setting passed alongside `mode` wins over that mode's default, and a call with settings but
no `mode` leaves the current mode alone:

```javascript
jqhtml.configure({ mode: 'production', debug_attributes: true });  // production, but inspectable
jqhtml.configure({ warn_uncacheable_args: true });                 // mode unchanged
```

## Passing your application's environment

Bundled applications usually know the environment at build time:

```javascript
jqhtml.init($, {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development'
});
```

Server-rendered applications should emit the value with the page rather than guess:

```html
<script>
  window.jqhtml.init(window.jQuery, { mode: "{{ app_environment }}" });
</script>
```

Configure **before** components render. `debug_attributes` is read while rendering, so a
component that has already rendered does not retroactively lose its debug attributes.

An unrecognised mode throws immediately rather than being ignored.

## Related

This is separate from `jqhtml.debug`, which is an interactive tracing switch you flip by hand
while debugging a specific problem — see [Debugging](../15-debugging/). Configuration here
describes the environment your application is running in.

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/official/20_runtime_configuration.md` - full specification
- `docs/official/15_deduplication_and_caching.md` - which args can be keyed

### Last Updated
2026-08-19

### Editorial Notes
- Added as chapter 18 rather than inserted earlier, so existing chapter numbers (consumed by
  the website parser and by the source-mapping table) stay stable.
- Deliberately does NOT document the transient `data-cid` the instruction processor uses
  internally during rendering. It is a different value from the one shown here, is removed
  before the debug attribute is written, and is never suppressed — an implementation detail
  with no bearing on how anyone writes components.
- The debug-attribute example shows both attributes disappearing while the scoped `id`
  remains, because the most likely reader error is assuming `$sid()` breaks in production.
