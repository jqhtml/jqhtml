# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 2.3.70 (2026-09-15)

### Added

* **debug overlay:** hover labels are `pointer-events: auto; cursor: pointer`. A mouseover
  inside the overlay's shadow host never changes the hover set, and page mouseovers are
  ignored while the pointer is on a label, so the outlines survive the trip onto a label.
  Leaving a label clears the hover set only when the pointer lands outside the innermost
  hovered component. Clicking a label inspects that label's component.
* **debug overlay:** `Back` and `Parent` buttons in the inspector title bar, before
  `Log to console` and `Close`. `Parent` shows when the component has a DOM parent
  component; `Back` shows while the navigation stack is non-empty and pops it, skipping
  entries whose component has since been stopped.
* **debug overlay:** `.jqhtml-debug-selected` (amber `outline: 2px solid #b45309`,
  `outline-offset: -2px`) marks the component the inspector is showing. It moves with the
  inspector and is removed by `close_modal()` and `disable()`; clearing the hover set
  leaves it alone, and the hover outline wins wherever both apply.

## 2.3.69 (2026-09-15)

### Added

* **debug overlay:** hover tabs are no longer capped at the component's own width - a
  component narrower than 400px gets a tab of up to 400px, and a tab that would overflow
  the viewport is slid back so its right edge sits 5px inside it.
* **debug overlay:** the inspector modal is split into `.jqhtml-debug-title`,
  `.jqhtml-debug-body` (the only scrolling element: `overflow-y: scroll`, min-height
  300px, max-height `min(600px, calc(100vh - 200px))`) and `.jqhtml-debug-footer`; the
  modal itself no longer scrolls. It gains `.jqhtml-debug-modal-left` and opens on the
  left when the inspected component is in the right half of the viewport.
* **debug overlay:** a **Lifecycle:** footer row with Reload, Refresh, Rerender and
  Reload w/o data. Each runs its call on the live component, logs any failure, and
  re-opens the inspector once the call settles.

## 2.3.68 (2026-09-15)

### Performance

* **escaping:** `escape_html` / `escape_html_nl2br` (and the same functions handed to
  compiled render functions) are string replacements instead of a `createElement` +
  `textContent` + `innerHTML` round trip per interpolated value. Output is identical
  (`&`, `<`, `>` encoded; `null`/`undefined` to ""). -27% on a text-heavy render
  (`tests_benchmark/scenarios/escape_heavy`). The render utilities object is now built
  once (`render_utilities`), not per render.
* **instruction processor:** the passes that apply tracked attributes and boot child
  components after `innerHTML` now do one `querySelectorAll` each instead of a
  `querySelector` per element, which had made both passes quadratic in template size.
  -57% on 3600 tracked elements, -25% on 800 child components
  (`tests_benchmark/scenarios/tracked_elements`, `many_components`).

### Removed

* **template-renderer:** `render_template()` is gone from the public API, along with the
  `template-renderer.ts` module. It was a second, broken renderer that nothing called: it
  passed the slots object where a content function was expected, ignored `extends=` and
  `_inner_html`, and awaited a synchronous call. Its `process_slot_inheritance()` was a
  duplicate of the slot-inheritance implementation in `component.ts` that had drifted out
  of agreement with it. `escape_html` / `escape_html_nl2br` are unaffected - they are
  defined in `escape.ts` and still exported.

### Bug Fixes

* **jquery plugin:** `$(component)` returns the component's root element again. The `$()`
  override recognised a component by duck-typing an `id()` method that `Jqhtml_Component`
  has never had, so the branch was dead and `$(component)` wrapped the plain object: `[0]`
  was the component, `addClass()` was a no-op and `find()` found nothing. It now tests
  `instanceof Jqhtml_Component`.
* **component replacement:** replacing a component on an element whose classes were all
  component classes removes the `class` attribute instead of leaving `class=""`.
* **component replacement:** a `stop()` that throws while replacing a component now
  propagates out of `.component()` and the element keeps its old component. It was caught
  and warned about, and the replacement overwrote a component whose `on_stop()` had not
  run - leaving its timers and listeners live against destroyed DOM.
* **component replacement:** an element whose tag does not match the component's expected
  tag is replaced whenever the replacement can actually happen (in the document, not
  `<body>`), not only when `args._inner_html` was truthy. `boot()` empties a placeholder
  before it sets `_inner_html`, so a placeholder with no server content kept the wrong tag
  with only a warning. The new element also inherits the old one's jQuery `.data()`, which
  was previously dropped - `$` args and caller data live there and are read back during
  component construction.
* **html cache:** a parent whose child has no `on_load()` no longer hangs. The pre-snapshot
  wait for children polled a flag that is only set once a component reaches the load phase,
  which a template-only child never does, so the parent never snapshotted, never ran
  `on_ready()` and never fired `ready`. Such a child is now marked render-complete after its
  first render (its data cannot change), and the wait is event-driven on the child's
  `render`/`stop` events rather than a 10 ms poll.
* **html cache:** a `reload()` that injects cached HTML always re-renders afterwards. The
  post-load render decision looked only at whether `on_load()` changed the data and ignored
  `_used_cached_html`, so a reload whose data came back unchanged left the injected
  snapshot on screen as inert markup - its children stopped by the injection, no live
  components under it. `_used_cached_html` now forces the re-render in `_reload()` exactly
  as it already did at boot.

* **template inheritance:** a slot-only template that cannot reach its parent template now
  throws instead of rendering an empty element. Both failure modes were swallowed into
  `instructions = []` plus a `console.warn`: a parent template that throws while rendering,
  and no parent template resolving at all. The error names the component and the parent
  template and travels the boot error path - logged, component stopped, waiting ancestors
  released.
* **define attributes:** `<Define>` default attributes resolve through exactly the chain
  templates do - explicit `extends=""` first, then the JS class prototype chain - via the
  same `resolve_parent_template()` helper the slot-only render path uses. They previously
  followed only `extends=`, so a slot-only JS subclass (`class Users_Grid extends
  Grid_Abstract`) inherited its parent's template but none of the parent `<Define>`'s
  `class=""` or attributes.
* **define attributes:** an invocation attribute whose value is `""` is no longer replaced
  by the `<Define>` default. The "already set?" test was falsy (`!this.$.attr(key)`), not
  `=== undefined`.

* **on_load args proxy:** the read-only `this.args` view memoizes its nested wrappers for
  the duration of one `on_load()` call. It built a fresh `Proxy` on every nested read, so
  `this.args.filter !== this.args.filter` for an object arg and identity comparisons inside
  `on_load()` silently failed.
* **caching:** the cache key is derived in ONE place (`generate_cache_key()`) for the
  cache read in `create()`, the cache write in `load()`, and SSR preload matching. The
  three derivations had drifted apart: `load()` and `set_preload_data()` built keys
  without content serialization, so a component with a plain-data object arg computed a
  null key and silently never wrote the cache that `create()` would later read with the
  content-serialized key, and never matched a preload entry.
* **ssr preload:** a captured entry now carries the `key` it was captured under, and
  `set_preload_data()` honours it. A `cache_id()` component's key shape
  (`<Name>::<cache_id()>`) cannot be reproduced from args, so preload never applied to
  one; entries without a `key` are now derived with content serialization, which is what
  the cache uses. `PreloadEntry` gains the optional `key` field.
* **caching:** a `cache_id()` that throws inside `load()` is no longer swallowed by a bare
  catch. The element is marked `data-nocache="cache_id():cache-id-threw"` and development
  mode warns once, as it already did for the boot-time load.

* **attributes:** a `"` inside an interpolated attribute value on a plain HTML tag
  (`<a title="<%= x %>">`) ended the attribute in the generated HTML, letting the rest of
  the value become new attributes. It is now emitted as `&quot;`; nothing else about the
  value changes.
* **html cache:** replaying one cached snapshot into two live components no longer gives
  them the same scoped ids. An entry now stores `{cid, html}` - the markup plus the `_cid`
  it was rendered under - and on injection every `id="<name>:<cid>"` is re-scoped: the
  snapshot owner's cid becomes the injecting component's `_cid` and every other cid
  (its children's) becomes a freshly generated one, consistently within that injection.
  The debug-only `data-cid` mirrors are rewritten with the same mapping. Previously the
  ids went in verbatim, so two instances hydrated from one entry carried duplicate ids and
  `$sid()` - which resolves through `document.getElementById()` - could return the other
  instance's element. The stored entry shape changed; entries written by an earlier
  version are ignored as a cache miss, and the `CORE_VERSION` scope marker clears them
  wholesale on the next version bump.
* **html cache:** a cache-mode reload no longer injects over a live subtree without
  stopping it. The `_cached_html` branch of `_render()` returned before the
  stop-children/clear-DOM block, so the components it overwrote never had `on_stop()`
  called - their timers and listeners leaked - and they stayed in `_dom_children` as dead
  entries every later ready-wait walked. That block, the off-DOM strategy check and the
  `_dom_children` clear are now one prologue both render paths run.
* **load coordinator:** a leader whose `on_load()` threw deleted the coordination entry
  without settling it, leaving every follower awaiting a promise nothing could resolve -
  the follower never rendered, never fired `ready`, and `jqhtml.boot()` or an ancestor's
  `ready()` hung with it. The error now rejects the waiters before the entry is cleared,
  and the next component with that key becomes a new leader.
* **load coordinator:** every coordinator call now uses the deduplication key captured
  when the component joined the group instead of recomputing it from current args, which
  `this.args` may legally have changed during `on_load()`. A stale recomputed key left a
  dead `loading` entry that later components followed, and made a follower with changed
  args adopt its own untouched `on_create()` data; such a follower now receives the
  leader's data.
* **load coordinator:** a completed entry with no followers is deleted immediately. It
  was kept forever, so the registry grew once per distinct component name + args for the
  lifetime of the page.
* **load coordinator:** the leader's data is stored as JSON text and parsed once per
  follower, so followers no longer share one object graph. Test:
  `tests/coordinator_error_and_cleanup/`.
* **ready:** `render('sid')` no longer invalidates the PARENT's sticky `ready` state. It
  delegates to the redrawable child, which invalidates and re-triggers its own `ready`;
  the parent had nothing left to re-trigger it, so every later `await comp.ready()` hung
  until an unrelated full render.
* **ready:** a `refresh()` / `reload(false)` that finds the data unchanged now triggers
  the `ready` event and restores the ready state on its no-render path. `on_ready()` is
  still skipped, as documented. Previously the cycle deleted the sticky marker and left
  `_ready_state` at 2 with nothing to restore them, so the documented polling pattern
  left the component permanently not ready after its first quiet refresh - and any parent
  waiting on that child hung with it.
* **ready:** `ready()` and the parent's wait for its children register `once()` handlers
  instead of permanent `on()` handlers, which grew both callback lists without bound on
  every render/reload cycle. The child wait also skips already-stopped children and is
  raced against the child's `stop` event, so a child stopped mid-wait releases its parent
  instead of wedging it forever.
* **lifecycle state:** `_ready_state` now takes its documented value 3 (rendered) at the
  end of a render that follows the load phase, and is restored to 4 by every path that
  fires `ready`. Test: `tests/ready_state_after_partial_render_and_refresh/`.
* **boot errors:** a hook that throws during boot now leaves a STOPPED component behind
  instead of a half-booted one. The error is reported through the debug error handler
  (still with the error object as a `console.error` argument, so `breakOnError` works and
  the stack survives) and the component is stopped, which fires the `stop` event an
  ancestor's child-ready wait is racing against. Previously the boot re-threw, nothing
  stopped the component, and one child with a rejecting `on_load()` meant no ancestor ever
  reached `on_ready()`.
* **boot errors:** that failure is no longer an unhandled promise rejection. `_boot()` is
  started without `await` and without a `catch` by both the template instruction processor
  and `$(el).component()`, so every hook throw in a programmatically created component
  reached `window` as `unhandledrejection`.
* **stop:** `_stop()` has no fast path any more. A component with no custom `on_stop()` and
  no `stop` listeners - the common case for a child - skipped both the
  `_Component_Stopped` class and the de-registration from its parent's `_dom_children`, so
  every re-render leaked dead children into the parent's registry and
  `.hasClass('_Component_Stopped')` reported nothing for a stopped component. The class,
  the de-registration and the `stop` event are now unconditional; `on_stop()` is still
  invoked only when overridden.
* **stop:** `render()`, `load()` and `_reload()` re-check the stopped flag after every
  await instead of only on entry, so a component stopped while one of them is parked in
  `on_load()` or waiting for its children no longer runs `on_loaded()` / `on_ready()` or
  fires `loaded` / `ready` afterwards. Test: `tests/child_boot_failure_releases_parent/`.
* **lifecycle:** `create()` snapshots `this.data` the moment `on_create()` returns, before
  the cache is read. The snapshot was taken after hydration, so on a warm `data`-mode cache
  `on_load()` restarted from cached data rather than from the `on_create()` state CLAUDE.md
  promises - `this.data.items.push(row)` in `on_load()` doubled the list on every warm boot.
  Test: `tests/on_load_restores_pre_cache_snapshot/`.
* **load:** `load()` returns `false` immediately, running nothing, when the component does
  not override `on_load()`. It previously ran the detached execution anyway; no snapshot is
  taken for such a component, so the empty detached clone was assigned straight over
  `this.data`, wiping whatever `on_create()` had set. Test:
  `tests/on_load_restores_pre_cache_snapshot/`.
* **lifecycle queue:** every collapsed caller now receives the result of the operation that
  actually ran. Two rapid `await this.load()` calls used to discard the SECOND executor and
  keep the first, so the second call resolved `false` although the data had changed and its
  `on_load()` had never run; the pending executor is now replaced by the newest one (the
  documented rule is "only the most recent call executes") and the value is returned through
  the queue instead of a per-call closure variable.
* **lifecycle queue:** an operation of a different type queued over a pending one no longer
  discards it. A `render()` landing on a pending `load()` dropped the load entirely while
  still resolving the load's caller as if it had run; the queue now holds at most one pending
  entry PER TYPE and runs them in call order. `reload()` and `refresh()` still share one
  entry - they share the `'reload'` type and settle precedence between themselves.
* **lifecycle queue:** a caller's promise settles when ITS operation finishes, not when the
  next queued one does. `await c.render()` used to also wait for a reload queued after it.
  An executor that throws now rejects only its own callers, and the queue continues with the
  next entry. Test: `tests/queue_collapse_and_ordering/`.

### Changed

* **the `this.data` freeze is DEEP.** While `this.data` is frozen, reading a nested object
  or array out of it returns a read-only view, so `this.data.items.push(x)`,
  `this.data.user.name = 'x'`, `this.data.items[0] = 9` and `delete this.data.user.x` throw
  the same way a top-level assignment always did; the error names the dotted path
  (`this.data.nested.list[0].id`). The freeze trapped only top-level `set`/`deleteProperty`
  before, so every nested mutation outside `on_create()`/`on_load()` was applied silently
  while the documentation promised the opposite. Reads are unchanged - `JSON.stringify`,
  `Array.isArray`, `.length`, spread, `for..of`, `.map`/`.filter`, `Object.keys` and
  identity (`this.data.items === this.data.items`; the views are memoized per object in a
  `WeakMap`) all behave exactly as before. `Date`, `Map`, `Set` and instances of classes
  registered with `register_cache_class()` are handed out unwrapped, because a Proxy
  receiver cannot satisfy their internal slots. Mutable bookkeeping belongs in `this.state`.
  Test: `tests/this_data_deep_freeze/`.

* **this.data is always a serialized copy of the `on_load()` result.** The cache
  serializer's round trip now runs in EVERY cache mode, not only `'data'`, and before the
  assignment rather than after it. `this.data` is therefore jqhtml's own copy - the
  author's object graph is never aliased - and is by construction what the cache stores and
  what a cache hit returns, so enabling caching cannot change what a component sees.
  `Date`, `Map`, `Set` and classes registered with `register_cache_class()` are
  reconstructed. Anything the serializer cannot express is STRIPPED rather than passed
  through: functions, promises, DOM nodes, jQuery objects and `Jqhtml_Component` instances
  are dropped (omitted from objects, `null` in arrays), an unregistered class instance
  becomes a plain object of its own enumerable properties, and a cycle is cut at the
  back-edge. In development each stripped value emits exactly ONE `console.warn` per
  component name + dotted path for the life of the page, naming the component, the path,
  the kind of value and where it belongs (`this.args` for callbacks, `this.state` for
  DOM/timers/files/sockets, `register_cache_class` for model instances); production
  converts silently. `normalize_for_cache()` no longer returns the original value when
  serialization fails - it always returns the round-tripped copy. Test:
  `tests/load_result_normalized/`.
* **caching:** the quota-exceeded recovery in `_set_item()` re-stamped `_jqhtml_cache_key`
  with the raw developer key instead of the versioned scope marker (`<version>::<key>`)
  that `_validate_scope()` compares against, so the very next write looked like a scope
  change and wiped every jqhtml entry a second time - discarding whatever the retry had
  just re-cached. Test: `packages/core/test/cache-scope-versioning.test.js`.
* **lifecycle:** the `create` event fires exactly once. `boot_component()` triggered it a
  second time immediately after `component.create()` had already fired it, so every
  `.on('create')` subscriber saw it twice. Test: `tests/create_event_fires_once/`.
* **attributes:** a hand-written `id` is emitted exactly as written. It was rewritten to
  `<value>:<cid>` when - and only when - the element also carried some other tracked
  attribute (`$…`, `@…`, `on…`), so `<label id="x" @click=…>` and `<label id="x">`
  disagreed. `$sid` is unaffected: the compiler emits its scoped id directly. Tests:
  `tests/attribute_quote_escaping/`, `tests/content_handler_context/`.

## 2.3.67 (2026-09-14)

### Features

* **value printers:** `add_object_printer(fn)` registers a printer for objects reaching an
  interpolation; `print_object(value, mode)` (called by compiled templates) walks the chain
  in order - `undefined` declines, a string is escaped according to the construct
  (`escape` / `raw` / `nl2br`), a `{component: {name, args, attrs}}` descriptor becomes a
  component instruction with `args` as `$`-prefixed props and `attrs` as plain attributes.
  Throws naming the constructor when nothing handles the value and naming the printer's
  chain position when it returns an invalid shape or an invalid component name.
  `dynamic_component_name(value)` is the render-time validator behind `<{expression}>`.
  Both are on the utilities object passed to render functions. Tests:
  `test/value-printers.test.js`.

## 2.3.65 (2026-09-07)

### Bug Fixes

* **component_name():** now returns the name the component was invoked as - the
  template tag (`<User_Card>`), the name given to `$(el).component('User_Card')` or the
  boot placeholder - instead of the JS class name, which reported `Jqhtml_Component`
  for every template-only component. The name is carried on the new
  `_component_name` property; every invocation path now passes it, including
  `$(el).component(Class)`, which records the class's static `component_name` or its
  own name.

### Features

* **debug overlay:** `jqhtml.debug_overlay.enable()` / `disable()` / `is_enabled()` /
  `inspect(x)` - an in-page component inspector. Hovering outlines the component under
  the pointer and every ancestor (inset outline, no layout effect) with a tab naming the
  component and its string/number/boolean args; clicking opens a modal with identity,
  args, data, state, DOM ancestry, instantiator and a log-to-console button instead of
  running the page's handlers (Alt+click passes through, Esc closes). The overlay's UI
  renders in a shadow root and page elements only ever receive outline classes gated
  behind `html[data-jqhtml-debug]`; stylesheets are SCSS compiled at build time,
  audited against that convention, and injected on first enable. Components created
  after enable are covered automatically; `enable()` is a no-op without a DOM.

## 2.3.62 (2026-09-07)

### Features

* **naming:** `register_component()`, `register_template()`, `closest('_Name')`, the
  component-name classes applied to the rendered root, and the class stripping done when
  `$(el).component()` replaces a component all accept a single leading underscore
  (`_Root_Layout`). `src/component-name.ts` holds the one rule
  (`^_?[A-Z][A-Za-z0-9_]*$`), exported as `is_component_name` and
  `COMPONENT_NAME_PATTERN`; `Jqhtml_Component.COMPONENT_NAME_PATTERN` now aliases it.
  The root-element class filter still drops mangled `_`-prefixed class names that do not
  match the rule. `__Foo` and `_foo` are rejected with "must start with a capital letter,
  optionally preceded by a single underscore".


## 2.3.61 (2026-09-03)

### Bug Fixes

* **rendering:** markup written in one component's template and rendered inside another
  (a `<Slot:>` body, or default content between a component's tags) now binds its
  `@`/`on*` handlers, scopes its hand-written `id=`, and sets `instantiator()` of
  components written in it to the DEFINING component, matching `<%= %>` and `$sid`.
  Previously the receiving component was used, so a handler written in A next to
  `$sid` and `this.args` that resolved to A silently ran with `this === B`. The
  compiler now splices content as `['_content', instructions, definer]`; the
  instruction processor renders that block in `definer`, and the per-element
  context it already recorded is honoured when attributes are applied. The
  `_flatten_instructions` step that discarded the context is removed.
* **inheritance:** a slot-only template's slot functions receive every argument
  passed to `content('name', ...)`, not just the first.

## 2.3.54 (2026-08-19)

### Features

- **`on_viewport_resize(viewport_width)` on Component** — a viewport hook that replaces
  per-component `$(window).on('resize')` bindings. The framework installs one window
  `resize` listener, debounced 30ms on the trailing edge, and dispatches to every
  component in the document by walking `$('.Component')` in document order. The hook also
  fires automatically after every `on_render()` and after every `on_ready()`, so a
  component's sizing logic lives in one place instead of being duplicated between
  `on_ready()` and a resize handler.

  The argument is `window.innerWidth` — viewport width in CSS pixels including the
  scrollbar gutter, so it agrees with what CSS media queries resolve against. For the
  component's own width use `this.$.width()`.

  Detached components are not found by the walk and stopped components are explicitly
  skipped, so there is no listener to unbind — this removes the leak the old pattern
  invited, since `on_stop()` is not guaranteed to run when a node is orphaned. A handler
  that throws is logged and the walk continues. Must be synchronous. It is the one `on_*`
  hook not protected from manual invocation, having no lifecycle invariants to violate.

  Base implementation is a no-op stub, so components that don't override it are
  unaffected. New source file: `src/viewport.ts`. Test: `tests/viewport_resize`.

- **`gate_load(promise)` on Component** — register "load gates" during `on_create()`
  that defer a component's **first** `on_load()` until the supplied promises settle
  (awaited together via `Promise.allSettled`). Gates are one-shot (first load only —
  `reload()`/`refresh()` never re-await), rejections are logged and never block the
  load, and gates delay only the load phase (never `create()`, render, `on_render()`,
  or the cached first paint). Calling `gate_load()` after the first load throws.
  While gated, the wait is released by whichever comes first — all gates settling,
  `reload()`, `refresh()`, or `stop()` — and any later settlement is a no-op. A no-op
  during SSR. jqhtml stays agnostic about what is awaited; timeout policy is the
  caller's. See `docs/reference/14_lifecycle_complete_specification.md` (§4a) and the
  `tests/gate_load/` behavioral test.

## 2.2.13 (2025-09-21)

**Note:** Version bump only for package @jqhtml/core





## 2.1.10 (2025-09-18)

**Note:** Version bump only for package @jqhtml/core





## 2.1.9 (2025-09-18)

**Note:** Version bump only for package @jqhtml/core
