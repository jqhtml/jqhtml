# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 2.4.0 (2026-10-23)

### Features

- **`skip_cache_read`**: a reserved boolean arg (`$skip_cache_read=true` /
  `{skip_cache_read: true}`) for a subtree hidden behind a spinner until ready on every
  visit. It skips the cache read - no data hydration, no cached-HTML first paint, no
  `use_cached_data` hit, no cache read on a `reload()` with changed args - so the
  component boots as on a miss. Cache writes (data after `on_load()`, the HTML snapshot),
  the `was_ready_before()` marker and load deduplication are unchanged. Every component
  created inside it, by template, re-render or `$(el).component()`, inherits it from its
  nearest component ancestor at create time; a descendant cannot turn it off. It is removed
  from `this.args`, so it is in neither the cache key nor the dedup key. Documented in
  `docs/reference/15_deduplication_and_caching.md`; test `tests/skip_cache_read`.
- **A component that is not `:visible` skips the cache read.** At create and on a
  `reload()` with changed args, a component with no layout box (`display:none` on it or an
  ancestor) boots as on a miss, the way a detached one already did; it still writes the
  cache. Checked only when a cache key is set (`.is(':visible')` forces layout), in
  `read_cache_in_create()` and `check_cache_on_reload()`.

## 2.3.77 (2026-10-23)

### Features

- **`was_ready_before()`**: whether an earlier instance of this component with the same
  cache key (name + args, or `cache_id()`) reached ready in the current cache scope.
  Callable from `on_create()`, so a page component can show a loading cover on a cold
  first visit and let the cached paint show on a revisit. Opt-in: a component that calls
  it writes a `<cache_key>::ready` marker through the cache storage when it reaches ready;
  components that never call it write nothing. Works with or without `on_load()`, in both
  cache modes. The answer is frozen per key (still `false` in a first visit's own
  `on_ready()`); a `reload()` to new args looks up the new key. `false` without a cache
  key, with unkeyable args, or for a component created detached; a component stopped
  before ready writes no marker. Markers are cleared with the cache on a scope or version
  change. A hint only: jqhtml never acts on it. Documented in
  `docs/reference/15_deduplication_and_caching.md`; test `tests/was_ready_before`.
- A component's detached state is now determined before `on_create()` instead of after it,
  so `was_ready_before()` sees it there. Nothing else reads it before that point.

## 2.3.76 (2026-10-21)

### Bug Fixes

- **`content()` returns `''` for a slot that emits nothing.** A slot written empty
  (`<Slot:note></Slot:note>`), or holding only HTML whitespace such as line breaks and
  indentation, now reads as falsy like a slot that was left out. Before, it returned a
  truthy markup buffer, so a component could not decide whether to draw a wrapper around
  an optional slot. A caller cannot wrap a `<Slot:>` tag in `<% if %>`, so an empty slot is
  how "nothing here" is written. Text, any element, any component, `&nbsp;` or a printed
  `0` is content; a slot that only passes another slot down counts by what that one emits.
  The same rule applies to unnamed `content()` and to slot-only template inheritance. The
  supported pattern is to call `content()` once, test its truthiness, and emit it:

  ```jqhtml fragment
  <% const _note = content('note'); %>
  <% if (_note) { %><div class="note"><%= _note %></div><% } %>
  ```

  The value's shape is internal: code that inspects it (`Array.isArray`, `[0]`,
  `.instructions`), including checks written against the 2.3.74 `[instructions, context]`
  pair, must be replaced with the truthiness test. The 2.3.75 guidance to "test it for
  presence" gave the wrong answer for empty slots and is superseded by this. Documented in
  "Optional Slots" in `docs/reference/06_slot_system.md`. Test:
  `tests/empty_slot_content`.

## 2.3.75 (2026-10-21)

### BREAKING CHANGES

- **The compiled template format changed.** Render functions, component content functions
  and slot functions now return a markup buffer (`new jqhtml.Markup(this)`, appended to
  with `_output.p(...)`) instead of the `[_output, this]` pair, `content()` splices that
  buffer instead of a `['_content', instructions, definer]` marker, and a slot-only
  template returns `{_slots: {...}}` instead of `[{_slots: {...}}, this]`. `@jqhtml/parser`
  and `@jqhtml/core` must be the same version, and every precompiled template - build
  output, bundler caches, framework template caches - must be rebuilt with the 2.3.75
  parser. A hand-written render function must return a `jqhtml.Markup` (the fourth
  render argument is `jqhtml`).
- **A `<%= %>` or `<%!= %>` expression inside a quoted attribute value must stay on one
  line**; spanning lines is now a compile error ("A <%= %> expression in an attribute
  value must be on one line"). Literal text in the value may still span lines, and so may
  `<%= %>` in element content. Migration:
  - A `$` attribute: use the bracketed form, which takes JavaScript directly, may span
    lines and gives the same value - `$options="<%= JSON.stringify([ ... ]) %>"` becomes
    `$options=(JSON.stringify([ ... ]))`.
  - A regular attribute: compute the value in a `<% %>` block first and interpolate the
    variable on one line.
  The error for `$attr=<%= ... %>` now suggests the bracketed form instead of quoting a
  `<%= %>`. A `//` comment that hides a `%>` in an attribute value is explained with
  `/* */` as the fix. Tests: `packages/parser/test/template-rules.test.js`,
  `tests/error_messages_attribute_interpolation`.
- **Character references in quoted attribute values are resolved at compile time**, as
  the HTML parser resolves them (named with or without `;`, numeric, the historical
  attribute rule that leaves `&copy=2` literal). `title="Tom &amp; Jerry"` is now the
  string `Tom & Jerry` on every path. Before, only a plain tag got the decoded value: a
  tag with `@event` or `$sid`, a component attribute, a `$` arg (`$label="&nbsp;"`) and a
  `<Define>` default kept the raw `&amp;` text. The runtime now encodes `&` as well as `"`
  when it writes attribute HTML, so interpolated values are taken literally everywhere
  (`title="<%= x %>"` with `x = "&lt;"` used to show `<` on a plain tag). Element text is
  unchanged. Rebuild precompiled templates. Tests:
  `packages/parser/test/attribute-character-references.test.js` (checked against the
  HTML parser), `tests/attribute_character_references`.

### Features

- Source maps can be external. `compileTemplate(..., { sourcemap: 'external' })` returns
  `{ code, map }` - the map that `sourcemap: true` embeds, as an object, with no
  `sourceMappingURL` comment in the code - and `jqhtml-compile --sourcemap=external -o
  out.js` writes `out.js.map` and ends `out.js` with `//# sourceMappingURL=out.js.map`
  (it requires `--output`). Inline stays the default: `--sourcemap` and
  `--sourcemap=inline` embed the map as before. `@jqhtml/webpack-loader` now takes the
  map object directly instead of decoding the inline comment.
- `@jqhtml/webpack-loader` is published again, in lockstep with the other packages. It
  compiles `.jqhtml` imports in webpack 5 (`{ test: /\.jqhtml$/, loader:
  '@jqhtml/webpack-loader' }`); each import's default export is the template object of
  the file's first `<Define:>`, ready for `jqhtml.register()`. Source maps follow
  webpack's `devtool` and map to the template lines, a compile error fails the build with
  the file, line and column, and the module is cacheable. It uses only the standard loader
  API, so it is meant to run under Rspack as well (not yet tested there). This release
  supersedes the stale `@jqhtml/webpack-loader` 0.0.1 (public npm) and 2.3.7. The browser
  test harness now bundles every test's templates through the loader. Tests:
  `packages/webpack-loader/test/loader.test.js`, run by `./run-all-suites.sh`.
- `on_load_error(error)` lifecycle hook. The framework catches every `on_load()` failure
  (boot, `load()`, `reload()`, `refresh()`) and passes the error to it. The base
  implementation prints the error with `console.error`, naming the component, and the
  failure then runs its course: a failed boot stops the component and a failed
  `reload()`/`refresh()`/`load()` rejects. An override prints nothing, and the component
  continues: `on_loaded()` runs, the component re-renders with the `this.data` the override
  set, then `ready` fires, and a failed `reload()`/`refresh()`/`load()` resolves.
  `super.on_load_error(error)` keeps the print; an override that throws takes the default
  path. The hook has `on_load()`'s access (read `this.args`, write `this.data` from the
  `on_create()` state) and may be async. With deduplication, every component sharing a
  failed request runs its own hook with the same error, and fallback data is never handed
  to followers. Fallback data is never cached, and an instance whose `on_load()` has failed
  never reads or writes the cache again (`data` and `html` modes), even after a later
  successful reload. The hook is protected against manual calls. Test:
  `tests/on_load_error_hook/`.
- A failed boot `on_load()` prints its error once. The deduplication coordinator and each
  follower printed it as well, so a leader's error appeared two or more times; those
  prints are now verbose-mode logs, and the boot error report (`[JQHTML Error] ... failed
  in boot`) names a failure the base `on_load_error()` already printed without printing the
  error again.

### Behaviour Changes

- Every component event handler runs with `this` set to the component. It already was
  for `on()` handlers fired by `trigger()`; `once()` handlers and the immediate replay a
  handler gets when it registers after a sticky event has fired ran with `this`
  undefined. The first argument is still the component. Arrow functions are unaffected.
- **One lifecycle lock per component; boot is serialized with `render()`, `load()`,
  `reload()` and `refresh()`.** Every cycle - boot, or one of those calls - holds the
  component's lock from its start through the end of its own `on_ready()`. A call made
  meanwhile, including during the first `on_load()` or from inside `on_ready()`, waits and
  runs afterwards, in call order, reading `this.args` when it starts. Previously boot
  bypassed the queue, so a `reload()` during the first `on_load()` ran a second load
  concurrently - the last response won, possibly old-args data, and it could be cached
  under the new-args key - and a `render()` during the boot load ran `on_ready()` and
  fired a sticky `ready` before the data arrived. Now the reload runs after boot, its data
  stands and is cached under the key of the args it ran with.
- **A call made from `on_ready()` and not awaited runs after `on_ready()` returns**,
  instead of starting at once. `on_ready() { if (cond) { this.reload(); return; } ... }`
  re-runs the cycle, and `on_ready()` runs again on the reloaded state. An AWAITED (or
  chained) `render()`, `load()`, `reload()` or `refresh()` during `on_ready()` is pulled
  forward and runs at once, nested, and resolves as before - other queued calls still wait.
  Awaiting one inside the component's own `on_loaded()` never resolves (the call waits for
  `on_loaded()`): call it without `await`.
- **`ready` after the queue drains.** If boot ends with calls still queued, `ready` fires
  once, after they have all run, so `await comp.ready()` and `.on('ready')` see the
  post-reload state, never the state a queued call is about to replace.
- **New merging rule, replacing "only the most recent queued call executes" and "`reload()`
  takes precedence over `refresh()`".** A call merges only into the call waiting
  immediately before it (never the running one), and only when it is the same method with
  the same arguments (`refresh()` is `reload(false)`); the merged caller gets that call's
  result. No cross-method merging: `reload(), refresh(), reload()` is three runs, and a
  `refresh()` queued behind a `reload()` keeps its own rule (no render on unchanged data)
  instead of inheriting the reload's forced render.
- Every load is numbered; a load superseded by a newer one has its result dropped (no data,
  cache write or `on_loaded()`).
- Development warnings: a queued call made from the component's own `on_create()` or
  `on_render()` warns at once (it cannot run there). A `render()`, `load()`, `reload()` or
  `refresh()` made while `on_loaded()` runs returns a `Promise` subclass that warns once
  when awaited (or chained) before `on_loaded()` settles: "reload() was awaited while
  My_Component's on_loaded() is still running. If on_loaded() awaits this call it will
  deadlock: call it without await. Code outside the component should await comp.ready()
  before awaiting reload() or refresh()." - naming the real method. Unawaited calls, and
  awaits from outside during `on_load()`, are silent. Test:
  `tests/lifecycle_queue_boot_serialization/`.
- `tests/reload_debouncing` expects 2 `on_load()` runs (boot + one merged reload) for five
  rapid `reload()` calls, under the merge rule above; it expected 3.
- **`on_loaded()` runs and `loaded` fires for every component**, whether or not it
  implements `on_load()` (or `on_loaded()`). Without an `on_load()` they run where
  `on_load()` would have completed: at boot after the first render, and in `reload()`,
  `refresh()` and `load()` before any re-render - the same order as a component with
  `on_load()` (`on_loaded()`, `loaded`, re-render, `on_ready()`). Previously such a
  component skipped both, so `once('loaded')` on a template-only component waited forever,
  contrary to the documented lifecycle. `load()` on a component without `on_load()` was a
  no-op that returned `false` at once; it now queues like any `load()`, runs `on_loaded()`,
  fires `loaded`, and still returns `false` with `this.data` untouched. `_load_only` and
  `_load_render_only` suppress both, as before, and a stopped component gets neither. A
  component that overrides neither hook still boots without yielding. Test:
  `tests/loaded_without_on_load/`; `tests/loaded_event_trigger/` passes again.
- **A `<Define>`'s own default attributes beat its parent `<Define>`'s.** When two
  `<Define>`s in an inheritance chain (`extends=""` or the JS class chain) set the same
  attribute, the nearer one now wins: child over parent, parent over grandparent. This
  covers plain attributes (`title`, `tabindex`, ...), `data-` attributes and the
  `this.args` value they set, and each `style` property. Previously the farthest
  `<Define>` won, because each template in the chain was applied parent first with "only if
  not already set". The invocation still beats every `<Define>` (including `tabindex="0"`
  and `title=""`), `class` still merges in the same order, and `tag` is still never
  inherited. `$foo` and `data-foo` name the same arg, so a child spelling either one
  overrides a parent's other spelling. Test: `tests/define_defaults_nearest_template_wins/`.
- **A parent `<Define>`'s `$` arg defaults are inherited.** `<Define:Parent $size="large">`
  now gives `this.args.size === 'large'` to a child `<Define:Child extends="Parent">`, or to
  a JS subclass (slot-only included), that does not set `$size` itself. The chain is the
  one `<Define>` attributes follow (`extends=""` first, then the JS class chain), and the
  nearest `<Define>` that sets an arg wins; a `data-` attribute and an arg at the
  invocation still beat every `<Define>`. `$foo` and `data-foo` defaults are one arg, so a
  nearer `<Define>`'s `data-foo` beats a farther one's `$foo` and the other way round.
  Previously only the component's own `<Define>` supplied `$` defaults, so a subclass that
  relied on a parent's default being absent now sees it in `this.args`, in its template,
  in `on_load()` and in its cache key. Test: `tests/define_args_inherited/`.
- **Cache entry keys include the jqhtml version.** Every localStorage entry is now stored as
  `jqhtml::<developer_key>::<jqhtml_version>::<cache_key>` instead of
  `jqhtml::<developer_key>::<cache_key>`; the `_jqhtml_cache_key` scope marker
  (`<jqhtml_version>::<cache_key>`) is unchanged and is the key's suffix. Previously two tabs
  on different jqhtml versions using the same app cache key shared entries: the newer tab's
  `set_cache_key()` cleared the cache once, but the older tab kept writing and the newer one
  read those entries. Now each version reads only its own. Existing cached entries are not
  read after upgrading (a one-time cache miss); the first `set_cache_key()` after the
  upgrade clears them, as before, and the quota cleanup still clears every `jqhtml::` key.
  Tests: `packages/core/test/cache-version-keying.test.js`; the key-format assertions in
  `cache-scope-coexistence.test.js`, `cache-scope-versioning.test.js` and
  `tests/cache_shared_reference_serialization/` now expect the new format.

### Bug Fixes

- Compile error positions after a `<% %>` block inside a tag (a conditional attribute,
  `<b <% if (x) { %>title="..."<% } %>>`) were one column too far right for each space
  after `<%`. The lexer skipped that whitespace and rewound the position but not the
  column.

- Merging `style` strings no longer cuts values at a `:` or `;` that is not a declaration
  boundary. Every merge (Define defaults with the invocation, a nearer `<Define>` over a
  farther one, and a tracked element - one with `@click`, `$sid` and the like -
  re-applying its own style) split each rule on every `:` and `;`, so `url(http://...)`,
  data URIs and quoted font names such as `'A;B'` were truncated. A tracked element broke
  its own `style` even with no Define involved. Declarations are now split as the CSS
  tokenizer splits them: `;` only outside strings, comments and `()`/`[]`/`{}` blocks,
  each declaration at its first `:`, backslash escapes honoured. Property names compare
  case-insensitively (`COLOR` overrides `color`); custom properties (`--x`) compare
  case-sensitively. The merged string now reads as the browser reads the losing style
  followed by the winning one: the winner's declarations come last, so a losing
  `background` shorthand no longer resets a winning `background-image`, and a normal
  declaration no longer replaces an `!important` one. This changes the order of
  properties in the merged `style` attribute. Test: `tests/style_merge_css_values`.

- Calling `init()` again no longer wraps jQuery again. Core sets up jQuery on its own
  when a global jQuery exists, so the documented `jqhtml.init($, config)` call added a
  second layer of the `.html()`, `.on()`, `.find()`, `.val()` and `cleanData` wrappers,
  and every further call another; each removal and lookup went through all of them. The
  jQuery setup now happens once per jQuery; later calls still apply their config.
- `jqhtml.init($, config)` works as documented. `init` was only a named export, so
  `jqhtml.init(...)` and `window.jqhtml.init(window.jQuery, ...)` threw a TypeError; it is
  now on the default `jqhtml` object as well.
- **Security:** `<%= %>`, `<%!= %>` and `<%br= %>` no longer splice an array into the page
  as raw HTML. Any array result was pushed into the output instruction by instruction, and
  string instructions are written unescaped, so `<%= this.data.tags %>` with
  `['<img src=x onerror=alert(1)>']` injected markup even through the escaping form.
  Content from `content()` and slots was told apart from data only by shape (a two-element
  array whose first element is an array). An array now prints the literal text `(Array)`
  in all three forms - including one shaped like the old content pair - and only the
  markup buffer `content()` returns is spliced. Join or loop over an array to print it.
- Tabs with different cache scopes no longer wipe each other's cache. `_set_item()` in
  `local-storage.ts` re-checked the shared `_jqhtml_cache_key` marker before every write
  and cleared all `jqhtml::*` keys when another tab had stamped a different scope, so an
  old-deploy tab next to a new one, or two users in one browser, kept the cache permanently
  cold. The scope is now validated once, in `set_cache_key()`; entry keys already carry the
  cache key, so the tabs write disjoint keys. Entries of a scope no longer in use are still
  cleared the next time any tab sets a different scope. Test:
  `packages/core/test/cache-scope-coexistence.test.js`.
- A template `extends=""` that conflicts with the component's JS class now throws. The rule
  was documented but never checked: `resolve_parent_template()` let an explicit `extends=`
  win silently, so `<Define:Users_Grid extends="Grid_A">` with `class Users_Grid extends
  Grid_B` rendered Grid_A's template with Grid_B's methods. The class's JS ancestors up to
  `Jqhtml_Component` that have their own template are listed; if there are any, `extends=`
  must name one of them (any ancestor, not only the direct parent). No templated ancestors
  (a class extending `Jqhtml_Component` directly, only template-less helper classes in
  between, or a template-only component) and an `extends=` naming an unregistered template
  are not conflicts. The error names the component, the `extends=` target and the templated
  ancestors, and takes the boot error path (logged, component stopped, ancestors released).
  It applies to templates with markup too, since `extends=` also selects the inherited
  `<Define>` attributes. Checked once per template in `_render()` (`extends_conflict()` in
  `component-registry.ts`), cached until the next registration. Test:
  `tests/extends_js_class_conflict/`.
- `$(selector).component('Name', args)` creates a component on every matched element. It
  used `this.first()`, so with several matches only the first became a component and the
  rest stayed plain elements. Each instance gets its own shallow copy of `args` (nested
  objects stay shared), an element that already holds a component has it stopped and
  replaced, and the setter returns the original jQuery set (an element swapped for its
  template tag appears as its replacement). An empty set is now a no-op instead of
  throwing. The getter `.component()` still returns the first matched element's component
  and logs a console warning when the set holds more than one element. `render_spa` in
  `@jqhtml/ssr` reads `$(selector).first()` so a multi-match selector does not warn. Test:
  `tests/component_setter_all_matches/`.
- `reload()` keeps the cache key in step with `this.args`. It refreshed `_cache_key` only
  when the new args produced a key (`check_cache_on_reload()` in `component-cache.ts`), so
  new args that cannot be keyed (a function arg, say) wrote their data under the previous
  args' entry, and an args-unchanged reload never refreshed the key at all. The recomputed
  key is now always stored, null included, and such a reload writes nothing. In html cache
  mode a `reload()` whose load changed the data now snapshots the post-reload markup
  (children rendered, before `on_ready()`, as at boot); the entry used to keep the
  boot-time markup for the instance's whole life. An instance whose `on_load()` has
  failed still never writes. Test: `tests/reload_cache_key_refresh/`.
- A `reload()` with new cacheable args writes the cache under the new key even when the
  loaded data equals the previous load's. Writes happened only when the data changed, so
  a later boot with those args missed the cache. The rule now also writes when the key
  differs from the one the current data is cached under (`write_cache_on_loaded()` in
  `component-cache.ts`), in `data` and `html` modes; the same key with unchanged data
  still writes nothing.
- `reload()` into args that cannot be keyed sets `data-nocache="<arg>:<reason>"` and prints
  the dev warning, as boot and `load()` do, with the same `warn_uncacheable_args` gating.
  Keyable args on boot, `load()` or `reload()` now remove a stale `data-nocache`. One
  helper, `mark_cacheability()` in `component-cache.ts`, serves all three paths; `load()`
  now updates the marker on every call, not only when its data changed. Test:
  `tests/reload_cache_write_and_nocache/`.
- A failed `reload()` or `refresh()` restores the component's ready state before
  rejecting. The cycle deleted the `ready` marker and could leave `_ready_state` at 2, so
  every later `await comp.ready()`, and a parent waiting on the component, waited forever.
  The component keeps its previous render; `on_ready()` is not called again.

- In html cache mode, a parent no longer hangs on a child whose `on_load()` leaves its data
  equal to the `on_create()` defaults. Such a child does not re-render, and the parent waited
  for a post-load render before taking its snapshot, so it never snapshotted, ran
  `on_ready()` or fired `ready`. The child now counts as rendered once its boot render chain
  ends, so the parent's snapshot still holds every child's final DOM. This affected the first
  boot and cache-hit boots.
- `ready()` and `rendered()` resolve when the component is stopped. A stopped component
  never fires `ready` or `rendered`, so a waiter on one that was already stopped, or that
  stopped while being waited on, waited forever. That included a `_Component_Init`
  placeholder whose `on_create()` threw: `await jqhtml.boot()` never resolved and
  `jqhtml:ready` never fired. Both now resolve rather than reject. The promise resolves on
  stop; the callback does not run, since it runs only on a real `ready` or `rendered`.
  `rendered()` also no longer leaves a permanent listener behind on each call.

- A component stopped while its lifecycle is in flight runs no further hooks. One stopped
  while waiting for its children (for example by a parent re-render) ran `on_ready()`
  after `on_stop()`, reset its ready state, wrote an html cache snapshot and fired
  `ready`; one stopped during its boot `on_load()` still received the data and ran
  `on_loaded()`. Both now stop where they are. A deduplication leader stopped mid-fetch
  still hands the fetched data to its followers but does not apply it to itself, and a
  follower stopped while waiting no longer adopts the leader's data.
- A deduplication leader that fails after `on_load()` returns releases its followers. When
  the leader's `on_loaded()` threw, or its `on_load()` set `this.data = null`, the
  coordination entry stayed `loading`, so every follower and every later component with
  the same args waited forever. Both now fail the group exactly as an `on_load()` throw
  does: followers fail with the leader's error and the next same-args component becomes a
  new leader.
- `on_load()` leaving `this.data` as `null` or another non-object fails the load with an
  error naming the value. It failed inside the data setter with a `TypeError` and left
  `this.data` unfrozen.
- Data held in a `Map` or `Set` is now change-detected. `this.data` was compared as
  `JSON.stringify` text, which writes every `Map` and `Set` as `{}`, so loading entries into
  one never re-rendered the component, `refresh()` never re-rendered, `load()` returned
  `false` and the data cache was not written. Change detection now uses the cache serializer.
- `on_load()` restarts from an exact copy of the `on_create()` state. The copy was a JSON
  round trip, which handed `on_load()` a `Date` as an ISO string, a `Map`/`Set` as `{}`, a
  `register_cache_class()` instance without its prototype, and dropped keys holding
  `undefined`. It is now made by the cache serializer, which keeps all of them.
- The template compiler skips JavaScript with one scanner wherever it needs the end of a JS
  region (the `%>` of `<% %>`/`<%= %>`, the `)` of `$attr=(...)`, the `}` of `<{expr}>`,
  push merging in codegen), replacing six that disagreed on comments, regex literals and
  template literals. Strings with escapes, template literals with nested `${}`, line and
  block comments and regex literals (a `/` after an operator, punctuator, keyword such as
  `return`, or at the start) are recognised everywhere. Templates that failed now compile:
  `<% s.replace(/'/g,'') %>` ("Unterminated code block"), `<%= s.replace(/"/g,'') %>`
  ("Expected %>") and `<%= p.replace(/\//g,' > ') %>` ("Invalid regular expression flags").
- A `//` comment in `<% %>`, `<%= %>` or `<%!= %>` runs to the end of its line, wherever it
  starts on the line, and nothing after the `//` is parsed: a `%>` inside the comment does
  not close the tag. `<% foo(); // hello %>` and `<% foo(); // <% blah %>` are still open
  after that line; close the tag on the next line or use `/* */`. A comment line inside a
  multi-line block may mention `<% %>`. The comment is stripped, so it never comments out
  generated code that follows the block. A `//` inside a string, template literal or regex
  literal is not a comment. Before, a comment after code on the tag's first line was cut
  at `%>` (and `// don't %>` made "Unterminated code block") while a comment on its own
  line ran past it; there is now one rule.
- When a template fails to compile and a `//` comment in it hid a `%>` that looks like a
  close (the comment follows code or opens the tag's first line, or the `%>` ends the
  line), the error names it: "The %> on line 2, column 23 is inside a // comment (line 2,
  column 15), which runs to the end of the line, so it does not close the tag. Close the
  tag on a new line, or use /* */ for the comment." This covers a tag left unterminated
  and a later `%>` closing it into invalid JavaScript or broken markup. A later `%>` that
  closes it into valid code compiles without a message.
- An expression interpolated into `$sid` keeps its operator precedence. It was concatenated
  into the scoped id without parentheses, so `$sid="row_<%= i > 0 ? 'pos' : 'neg' %>"`
  compiled to `"row_" + i > 0 ? 'pos' : 'neg' + ":" + this._cid` and always produced
  `neg:<cid>`. The expression is now parenthesised, as it already was for other
  interpolated attributes.
- Template text can no longer escape the string literal the compiler puts it in. `tag=""`
  and `extends=""` on `<Define:>` were concatenated into single-quoted JS strings, so
  `tag="div', evil: alert(1), x: '"` or `extends="P'+alert(2)+'"` ran code when the
  compiled template loaded. Every piece of author text the compiler emits as data -
  component metadata (`name`, `tag`, `extends`, dependencies), attribute names and quoted
  values, `$` defaults, tag names, text, HTML comments and `$sid` literal parts - is now
  built with one `JSON.stringify`-based helper, which also escapes U+2028/U+2029. Ordinary
  templates compile to byte-identical output.
- An attribute name containing a character HTML does not allow in one - whitespace, `"`,
  `'`, `<`, `/` or a control character - is a compile error with its line and column. A
  name such as `x":alert(3),"y` was emitted as an object key and ended its string
  literal. `x-on:click`, `:class`, `@click.prevent`, `aria-label` and `data-foo.bar` are
  unaffected.
- An interpolated `id` is rendered. `<div id="x_<%= a || b %>">` compiled to
  `"id": "[object Object]"` because `id` was special-cased and only understood quoted
  values; it now takes the same path as any other attribute (`"x_" + (a || b)`). A
  hand-written `id` is still emitted exactly as written, never cid-scoped.
- **Breaking: templates that previously compiled with stray or mismatched tags now fail
  to compile.** The parser skipped any token it could not place in content, so a stray
  closing tag (`<div>a</span></div>`, a lone `</p>`, a surplus `</div>`), a stray `%>` or a
  `<Define:>` nested inside a definition was silently dropped from the output, and
  `<b></i>` reported "Unclosed tag: b". Each is now a compile error with its line and
  column: `Closing </span> does not match open <div> (line 3, col 9); <div> was opened at
  line 3, col 3`, `Closing </p> has no matching open tag (line 2, col 8)`,
  `Stray %> with no matching <% (line 2, col 9)`. A closing tag for an enclosing element
  reports the inner element as unclosed (`Unclosed tag: span (line 2, col 8); </div>
  (line 3, col 3) closes an enclosing element first`). A closing tag for an HTML void
  element (`</br>`, `</input>`, ...) is rejected: browsers turn `</br>` into a second
  `<br>` and ignore the others, and the compiler used to drop it. Void elements written
  without a closing tag and self-closing components are unaffected.
- Slot-only templates are validated as JavaScript. JS validation ran only for templates
  with markup, so `<Slot:x><%= a + %></Slot:x>` compiled with exit 0 and failed when the
  bundle loaded. Every template's final render function is now parsed as emitted
  (`new vm.Script('(' + render_function + ')')`), replacing a re-wrap of the body lines
  with a guessed header offset; the error reports the source line the parser stopped on.
- The compile error formatter no longer throws `Invalid count value` when an error's
  column lies past the end of its line or its line past the end of the file; that crash
  replaced the real error message.
- **Breaking: `<%br=` and unknown `<%` forms inside an attribute value are compile errors.**
  `title="<%br= x %>"` was emitted as raw JavaScript and `title="a<%-x%>b"` as literal
  text. `<%br=` now fails with `<%br= is not allowed in attribute values; use <%= %>`
  and any form other than `<%= %>`, `<%!= %>` with `Unknown template tag <%- in attribute
  value; ...`, each at the line and column of the `<%`. The literal text between
  interpolations is marked as text, so the parser never classifies it as an identifier
  or expression.
- Text keeps its non-breaking spaces. Whitespace collapsing used `\s` and `trim()`, which
  match U+00A0, so `a\u00a0\u00a0b` rendered as `a b`; only space, tab, LF, CR and FF
  are collapsed now.
- A trailing `;` is accepted in an attribute expression as in body expressions:
  `title="<%= x; %>"` failed to compile.
- A comma expression is one expression. `<%= a, b %>` compiled to
  `const result = a, b;` (a syntax error) and `<{a, b}>` passed two arguments to
  `jqhtml.dynamic_component_name`; both are now parenthesised and use the value of `b`.
- A slot name starting with a digit (`<Slot:1row>`) is rejected with `Slot name "1row" is
  not a valid JavaScript identifier`; it compiled to invalid JavaScript.
- **Breaking: `<script` and `</script` are compile errors anywhere a template emits them.**
  A compiled template may be inlined in an HTML `<script>` block, where that text ends
  the block. The `<script>` element was already rejected; the text in body text, an
  attribute value, a `<% %>` block, an expression or an HTML comment inside a definition
  now fails too (`</script is not allowed in a JQHTML template. ...`) at its line and
  column, in any letter case. `<%-- --%>` comments are never emitted and may contain it;
  a string that needs the text can be split (`'<' + '/script>'`). `tag="script"` and
  `tag="style"` on a `<Define:>`, a component or `<Redrawable>` are rejected as well.
- **Breaking: plain attribute values must be quoted on every tag, `<Define:>` included.**
  A parenthesised value skipped the rule: `<div title=(x)>` evaluated `x` and
  `<Define:X title=(x)>` stored the text `x`. Both now fail with `Regular HTML attributes
  must have quoted values.`, as `title=x` already did. `$` and `@` attributes still take
  `(expression)`.
- An invalid JavaScript error in a template is reported as `JavaScript syntax error in
  component "X": ...`; it said `Unbalanced bracket error` for every syntax error.
- The `^` under a compile error's source line points at the error column; it was drawn
  one column to the left.
- Compile errors point at their cause. A JavaScript syntax error in a template is
  reported at its template line and column (it was column 0, and in `<%= %>` the space
  after `<%=`). A bracket that the `<% %>` blocks leave unbalanced is reported where it is
  (`Unbalanced bracket error in component "X": { at line 2, col 13 is never closed`), not
  on the closing `</Define:>` line, unless a syntax error comes before it. An
  unterminated `<%=`, `<%!=` or HTML comment is reported where it opens, not at the end
  of the file. Lexer errors name the file instead of `<unknown>`.
- The space after a closing tag is kept. The compiler skips a space that repeats the
  one just before it, and that check carried across `</tag>`, the end of a component's
  content and slot boundaries, so `<b> </b> <i>` rendered as `<b> </b><i>`. The browser
  keeps that space - visibly when the element is its own box (inline-block, a flex
  item) or under `white-space: pre`. A run of whitespace in one place is still one space.
- A multi-line HTML comment keeps its newlines and spacing; they were collapsed to
  single spaces.
- Non-breaking spaces between slots are content, as everywhere else in a template:
  between the slots of a component invocation they are the "Mixed content" error, and
  a `<Define:>` whose slots sit beside any other content now fails with a "Mixed content
  not allowed in <Define:X>" error at that content instead of compiling to invalid
  JavaScript. Ordinary whitespace between slots is unchanged.
- A compile error's suggestion is printed once. Parser errors for an unclosed component
  definition or slot appended it to the message a second time, and the CLI printed the
  suggestion again after a message that already ended with it. The message now always
  carries the current suggestion exactly once, including one assigned after the error
  was created, which was previously missing from the message.
- `compileTemplate()` called without `version` stamps the parser's package version; it
  stamped the unreplaced `__PARSER_VERSION__` placeholder. The build's version injection
  now processes `dist/codegen.js` and `dist/compiler.js` and no longer warns about the
  nonexistent `dist/codegen.cjs` and `lib/codegen.js`.
- Compile errors report where the offending token starts. Tokens recorded the position
  after themselves, so errors pointed past the token (`<Define:bad_name>` at column 17
  instead of 9). Strict-tag errors were computed from offsets that drift after a code
  block with blank lines (`Closing </i> ...` reported a line late), a multi-line HTML
  comment counted every line twice and shifted every later position, and a quoted
  attribute value containing `<%` shifted the lexer's column by one.
- A multi-line `<%= %>`, `<%!= %>` or `<%br= %>` renders exactly its value. Its newlines
  were moved after the `%>` and rendered as a whitespace text node (`<b><%= 'x'\n%></b>`
  gave `x `), and inside a quoted attribute value they were appended to the value
  (`$options="<%= JSON.stringify([\n...]) %>"` ended with newlines). The expression is
  now joined onto one generated line where it stands; a newline inside a string or
  template literal in it becomes `\n`, so `` <%= `a\n  b` %> `` keeps its newline instead
  of becoming a space. Line numbering is unchanged.
- A template literal or block comment in `<% %>` is left as written. Blank lines inside
  one received a `/* empty line */` placeholder and every continuation line a leading
  space, changing the literal's value (or ending the comment early). `<%br= %>` is
  preprocessed as an expression rather than as a code block.
- Sourcemaps map to the template's line AND column. Every template body line mapped
  one line early (generated line N went to template line N-1), and every segment was at
  column 0, so DevTools could not tell two expressions on one line apart. Each emitted
  node - tag, text, expression, code line, attribute value, component, slot - now has a
  segment from its generated column to its template line and column, an expression
  joined from several lines has one per line, and an identifier expression
  (`<%= this.data.title %>`) has a `names` entry. Module wrapper lines map to the
  `<Define:>` tag. `CodeGenerator.generateWithSourceMap()` produces the same mappings. On
  the parser's test corpus the inline map grows 12% (its `mappings` field 80%).
- Generated line N is template line N for every construct. Component content and slot
  bodies are now generated on the lines they are written on, as top-level markup was: a
  component with content inside another component's content, or a multi-line `<% %>` in
  either, put newlines into the generated code, and the slots passed to a component
  were all generated on the component's line, so later lines were reported on the wrong
  line. A multi-line dynamic
  tag expression (`<{a ||\n b}>`), `$attr=(...)` value or conditional-attribute
  condition put a newline into the generated code with the same effect; each is now
  joined onto its tag's line.
- A closing tag is generated on the line of the `</tag>`. It went on the line its last
  child started on, so after a multi-line `<% %>` that opened a block
  (`<div><% if (q) {\n r(); } %></div>`) the `</div>` was generated inside the block and
  was missing from the output whenever `q` was false.
- A `once()` handler fires at most once when its event is re-triggered during dispatch.
  Its wrapper removed itself from the live handler list, but a dispatch already in
  progress iterates a copy, so when an earlier handler re-triggered the event the nested
  dispatch fired the `once()` handler and the outer dispatch fired it again. The wrapper
  now has a fired flag. Handler order is unchanged.
- Waiting for children to become ready no longer leaves a handler on each child.
  `_wait_for_children_ready()` registered `once('ready')` and `once('stop')` per child and
  only the one that fired was removed, so every wait left a `stop` handler on a child that
  became ready, or a `ready` handler on a child that stopped. It now uses the same settling
  wait as `ready()`, which removes both. `trigger()` calls handlers with
  `callback.call(component, ...)` instead of creating a bound function per handler; `this`
  and the arguments are unchanged. Test: `tests/event_system_edge_cases/`.

- Frozen `this.data` rejects every mutation route. `Object.defineProperty`,
  `Reflect.defineProperty`, `Object.setPrototypeOf` and `Object.preventExtensions` /
  `seal` / `freeze` succeeded on `this.data` and on nested values while frozen (the freeze
  proxies in `data-proxy.ts` trapped only `set` and `deleteProperty`), and
  `Object.getOwnPropertyDescriptor(this.data, 'items').value` was the raw array. They now
  throw with the same message as an assignment, naming the path, and a descriptor's value
  is the read-only view. `Object.freeze(this.data)` in `on_ready()` froze the data object
  itself, after which every nested read in that component threw a Proxy invariant
  `TypeError`; it now throws the freeze error and leaves the data readable. Test:
  `tests/this_data_freeze_holes/`.
- `this.data` holds no object `on_create()` still references elsewhere. After
  `on_create()` returns, `this.data` is replaced by its cache-serializer copy (the
  snapshot `on_load()` already restarts from) for every component, with or without
  `on_load()`, so `this.state.list = this.data.list = []` followed by
  `this.state.list.push(x)` no longer changes frozen data. Values the serializer drops
  (functions, DOM nodes, jQuery objects, component instances) are dropped from the
  `on_create()` data too. In development, after `on_create()` a warning names each
  top-level property of `this.data` that is not simple data (a primitive, plain object or
  array, or a Date, Map, Set or registered cache class); nested values are not checked.
  Test: `tests/this_data_freeze_holes/`.
- The deep-freeze wrappers of one component share one Proxy handler, with each wrapper's
  parent and key in a side table; a wrapper no longer allocates three closures, and the
  property path is built only for an error message, not on every read.

### Packaging

- Build and test tools are no longer installed with the packages. `@jqhtml/core` listed
  rollup, esbuild, sass, typescript, jest, playwright, jsdom and others under
  `dependencies`, and `@jqhtml/parser` listed jest, typescript and `@types/*`; they are now
  `devDependencies`. `@jqhtml/core` has no runtime dependencies (jquery stays a peer
  dependency), `@jqhtml/parser` depends only on `source-map`, and `@jqhtml/ssr` is
  unchanged (`jsdom`, `jquery`). The published files are the same.
- The release script computes the next version from the last commit (and the registry,
  if it is ahead) rather than the working tree, requires a clean tree, and restores every
  file it changed if the build, tests, VSIX packaging or commit fail, so a failed release
  no longer moves the next one to a later version number. `.version-state.json` is now
  part of the release commit, and the previous VSIX stays until the new one is built.
- The release script no longer installs global npm tools and no longer writes the user's
  npm config: it reads the registry credential from a file readable only by its owner and
  passes it to its own npm commands through a temporary config removed on exit. The VS
  Code extension `build.sh` no longer falls back to `npx --yes @vscode/vsce`; it uses a
  local `vsce` and fails with instructions when none is available.
- The repository's root `package-lock.json` is current again: it records the release
  version and includes the VS Code extension's development dependencies, so `npm ci`
  works in a fresh clone. The public repository's copy lists only the published packages
  (no `packages/vscode-extension`), so `npm install` in a public clone no longer rewrites
  it. The unused `packages/core`, `packages/parser` and `packages/ssr` lockfiles are
  removed; the root lockfile covers all workspaces.
- The release script now stamps the new version into the root `package-lock.json` (the
  root and workspace entries and webpack-loader's exact `@jqhtml/parser` pin), so the
  release commit carries a lockfile that matches its package.json files; before, every
  release left it one version behind. Only those version fields change
  (`scripts/stamp_lockfile_versions.js`); node_modules is not touched. A lockfile whose
  workspaces or `@jqhtml/*` dependencies do not match the package.json files stops the
  release before anything is committed, and the tree is restored. The stale
  `packages/router` entry (2.2.222; the package no longer exists) is removed from the
  lockfile. Tests: `scripts/test/stamp_lockfile_versions.test.js`, run by
  `run-all-suites.sh`.
- The root `package.json` no longer lists `webpack`, `webpack-cli`, `express` or `lerna`.
  Nothing at the root used them (the test harness and the webpack loader declare their own
  webpack), and the lockfile drops the 503 entries they brought in. The lerna scripts
  (`lerna`, `version`, `publish:lerna`, `publish:npm` and a private-registry publish) are removed
  with it: `npm run publish:npm` published through lerna and skipped `publish-npm.sh`, and
  the `version` script ran on every `npm version`. Old release snapshots and version
  scripts that no longer match the release process are removed. The documented version
  scheme now matches the release script: `2.MINOR.PATCH`, PATCH plus one per release.
- The release script's test gate is now the full suite with the browser tests on
  Chromium (`./run-all-suites.sh --browser=chromium`) instead of the parser, core and
  webpack-loader unit tests alone. A failing suite stops the release before the commit and
  restores the tree. `--skip-tests` still skips the gate, with its warning.

### Performance

- `this.data` is serialized once per data generation: the text an `on_load()` result is
  normalized through is reused for change detection, the last-render snapshot, the cache
  write and the deduplication hand-off. Components without `on_load()` no longer snapshot
  args and data on every render. Chromium, against 2.3.74: boot of a component loading
  1000 rows -35%, `reload()` of it -38%, re-rendering 1000 row components -7%.
- `on_viewport_resize()` is no longer called on components that do not override it: the
  calls after `on_render()`/`on_ready()` and the window resize dispatch skip a component
  whose hook is still the base no-op. The check is made on every call, so a hook assigned
  to an instance (in `on_create()`, as a class field, or later) is still called. Call
  points, document order, and skipping of stopped and detached components are unchanged.
  Test: `tests/viewport_resize_override_filter/`.
- Per-instance overheads trimmed: the base `get_class_hierarchy()` walk is computed once
  per class (a class that overrides or patches the static method is still asked for every
  instance); the prototype walk in `get_template_by_class()` is cached per class and
  dropped by every class or template registration (the static `template` property is
  still read live); the lifecycle-protection method table is built once, not per instance
  (the guard wrappers stay per instance, so a manual call still names its own component);
  `_log_lifecycle()` returns before calling into the debug module when no lifecycle
  logging flag and no `window.JQHTML_DEBUG` hook is set; an element's `$name` and
  `data-*` values are stored with one `.data()` call instead of one per key (values of
  `undefined` are still not stored, and write order is kept); `@click`/`on*` handlers are
  invoked with `.call()` instead of a `bind()` per event; and a cache-key decline (for
  example an arg holding a callback) is returned instead of thrown as an `Error`, so it no
  longer captures a stack trace. Reasons, `data-nocache` and the dev warning are
  unchanged. Each is within noise on the render benchmarks (Chromium, against HEAD, with
  an A/A control). Tests: `tests/runtime_overhead_invariants/`, and
  `packages/core/test/cache-key-serialization.test.js`.

### Tests and tooling

- Browser tests no longer depend on system load. A stress run (the full Chromium suite with
  every core saturated, then the timing-sensitive tests at 4x saturation) found tests
  that assumed how far the lifecycle had got after a fixed sleep, or that a step finished
  within a time limit. Each now checks the behaviour itself:
  - `stop_and_on_destroy`: "stop() under 5ms" became a call-order check (`on_stop()`
    runs inside `stop()`, which returns no promise);
  - `ssr_preload`: "preload under 200ms" became a count of `on_load()` calls;
  - `slot_inheritance_errors_surface` and `extends_js_class_conflict`: dropped
    "ready within 1s" (reaching ready is the proof; core has no fallback timer);
  - `off_dom_component_creation`: awaits the off-DOM component's `ready()` instead of
    a 100ms sleep;
  - `stopped_component_waiters_settle` and `stopped_component_lifecycle`: hold a
    component's `on_load()` open until the test releases it, instead of sleeping into
    a timer; "never ran" checks wait for the load to finish plus a few event-loop
    turns. A control confirms that an unstopped component does run `on_loaded()` by
    that point.

  At 4x saturation, the timing-sensitive tests passed 212 of 216 runs; the failures were in
  the last two tests above (since fixed, then 54 of 54) and one harness port collision in
  the stress script itself.
- Dependency cleanup: the root `playwright` is 1.56.1 (was 1.55.0; the same browser
  builds the render harness uses), `@jqhtml/core`'s test-only jsdom is ^27 and shares the
  root copy instead of a nested 26.1, and the unused root devDependencies
  `@playwright/test` and `@types/jest` are gone. The two GitHub Actions workflows were
  removed: `publish.yml` ran `lerna publish`, bypassing the publish scripts, and `ci.yml`
  built a `demo-app` that does not exist.
- New tests: `invalidate(event_name)` and the payloads that sticky events replay
  (`tests/event_invalidate_and_sticky_payloads/`); `jqhtml`'s named `init(jQuery, config)`
  export (`packages/core/test/init.test.js`); the context of `@click` handlers in slot
  bodies on a slot-only template (`extends=""` and the JS class chain), after the
  receiving component calls `render()`, and through three-level slot forwarding
  (`tests/slot_handler_binding_paths/`). They test the current behaviour; no runtime code
  changed.
- Removed test scripts that no suite ran: `tests/integration/` (13 scripts),
  `tests/session_storage/` (tested the removed `Jqhtml_Session_Storage`), the empty
  `tests/unit/`, the 20 `packages/parser/test/test-*.js` scripts with their
  `test-cli-sourcemap.jqhtml` input, and `run-undefined-null-tests.js` (an older copy of
  `undefined-null-output.test.js`). They used retired syntax (`<% if (x): %>`,
  `<#slot>`, `$id`), APIs that no longer exist, or paths outside the repository, and most
  printed results without asserting them. The parse-error, AST-position and
  `ErrorCollector` checks that no other test covered are now
  `packages/parser/test/parse-errors-and-positions.test.js`.
- `tests_sourcemap/jqhtml-sourcemap-visualizer.js` runs again: it compiles through
  `compileTemplate()` (it imported `generate_with_source_map`, which the parser does not
  export), decodes every segment of a line, and shows the right output line numbers.
  `tests_sourcemap/jqhtml-sourcemap-analyzer.js` no longer counts the `sourceMappingURL`
  comment as an output line, so a complete source map no longer reports one segment
  missing.
- Dead code removed, with no change in behaviour (the parser regression corpus is
  byte-identical): the stale hand-written `packages/parser/src/{ast,lexer,parser}.js`
  (never compiled or published), the `example-*`, `demo-*`, `test-lexer.ts`,
  `test-parser.ts` and `test-sourcemap-final.js` files at the parser package root, the
  lexer's uncalled `scan_comment()` and `match_keyword()`, the parser's uncalled
  `parse_top_level()`, the code generator's uncalled `parse_attributes()` and
  `is_self_closing_tag()`, its `compile_interpolated_value()` with the three unreachable
  attribute branches that called it, and its code-block handling of `IF`/`FOR` tokens the
  lexer never emits, and core's uncalled `_log_debug()`. `render(sid)` and
  `_render(sid)` share one lookup of the `$redrawable` child instead of two copies;
  `tests/render_sid_lookup_errors/` covers its two errors from each entry point (it
  passes on the old and new code alike).
- Removed from `packages/core/test` the scripts and pages jest never ran
  (`test-implementation.js`, `test-playwright.js`, `test-playwright-bundle.js`,
  `test.html`, `test-simple.html`, `test-debug-overlay.html`); they loaded files the build
  no longer produces. `sid-guard-test.mjs`, the only check of the hand-written `data-sid`
  guard, is now the browser test `tests/sid_guard_hand_written_data_sid/`.
- CLAUDE.md said `load()` triggers no lifecycle events; it runs `on_loaded()` and fires
  `loaded` (whether or not the data changed), and does not re-render or fire `ready`.
  Corrected; `tests/load_method_runs_on_loaded/` pins that behaviour.
- The 15 browser tests that never produced a verdict, or asserted stale behaviour, now
  assert and pass in every cache mode on Chromium, Firefox and WebKit. Assertions added
  (they printed output and asserted nothing): `args_simple_test`,
  `conditional_attributes` (now mounts an all-false and an all-true variant),
  `control_flow_brace_style`, `interpolated_attribute_expressions`, `js_class_support`,
  `lifecycle_bottom_up_timing` (restores the `$id` args lost in the `$id` -> `$sid`
  rename; asserts order only, not timing), `off_dom_component_creation`,
  `redrawable_and_scoped_sids`, `whitespace-preservation` (on collapsed text; the
  double space before case 9 is accepted as is) and `windows_line_endings` (a
  `.gitattributes` `-text` entry keeps its CRLF fixture). Stale tests corrected:
  `slot_reserved_words_validation` uses `<Slot:word>` instead of the retired `<#word>`
  and requires the reserved-word error itself; `dom_access_restriction` test 7 expects
  `component_name()` to throw in `on_load()`, as documented; `lifecycle_method_protection`
  records its load step from `on_loaded()` (`this.state` is blocked in `on_load()`) and
  checks the exact order; `underscore_component_name` inspects the element the
  `.component()` setter returns after a tag swap; `detached_boot` group 5 uses its own
  cache key. `dom_access_restriction` and `lifecycle_method_protection` gained a verdict.
  Stale `$id`/`id()` wording in those tests' READMEs and scripts now says `$sid`/`sid()`.
- `tests_benchmark/run.cjs` no longer favours the baseline. Every switch of runtime
  stacked another layer of jqhtml's jQuery wrappers (45 `cleanData` layers by the end of
  a page), so the side that ran second in an iteration paid one more layer, and the fixed
  alternation over 21 iterations (11 in one order, 10 in the other) left that in the
  median: identical code was reported up to 10% slower on `load_table_boot`. The page now
  restores jQuery before each bundle loads and before every switch; the load, warm-up
  and per-iteration orders come from a seeded generator (`--seed=N` replays them), each
  order followed by its reverse; and the change is the geometric mean of the median
  ratios with the side before and after baseline. Each comparison now runs an A/A
  control (the baseline against a second copy of itself) and prints its change and 95%
  bootstrap interval; an A/B change inside that interval is marked `n.s.` and cannot be
  PASS or SLOWER. `--no-aa` skips the control (about 5 minutes instead of 9 for all
  eight scenarios on Chromium). In three A/A runs (identical code on both sides)
  every scenario read between -2.8% and +1.7%, `load_table_boot` between -1.9% and
  +0.7%. Absolute times are lower than before (the stacked wrappers ran on every
  `.html()`, `.find()` and removal; `escape_heavy` went from about 45 to 25 ms), so
  compare them only with runs from the new harness. The method is unit-tested in the new gate suite "benchmark: method"
  (`tests_benchmark/test/method.test.cjs`).

## 2.3.74 (2026-10-08)

### Bug Fixes

- `is_attached()` is now a live answer: `true` when the root is in the document right now
  and the component is not stopped. In 2.3.72 it returned the recorded state behind the
  `attach`/`detach` events, which was `false` inside `on_create()`/`on_load()`/`on_ready()`
  for an in-document component (the first check runs after the `ready` handlers) and stayed
  `true` for an untracked component removed natively. The events, their timing, strict
  alternation and `detach`-before-`stop` are unchanged; `is_attached()` never starts
  tracking and can run a moment ahead of the matching event.

## 2.3.72 (2026-10-08)

### Features

- `attach` / `detach` lifecycle events, `on_attach()` / `on_detach()` hooks and
  `is_attached()`. A component's root entering or leaving the document is reported
  whatever the removal path, including native DOM removal that `stop()` cannot see. The
  first check runs after `on_ready()` and the `ready` handlers; transitions strictly
  alternate and fire once each; `stop()` on an attached component fires `detach` first.
  Tracking is opt-in (override a hook or `.on('attach'|'detach')`) and lazy: one
  document-level `MutationObserver` re-checks `isConnected` per tracked component per
  mutation batch, holds them by `WeakRef`, and disconnects when nothing is tracked.
  Diagnostics: `jqhtml.tracked_attachment_count()`, `jqhtml.attachment_observer_active()`.

### Bug Fixes

- `stop()` now runs for every jQuery removal. `jQuery.cleanData` - the routine `.remove()`,
  `.empty()`, `.html(x)`, `.text(x)`, `.replaceWith()` and `.replaceAll()` all pass the
  removed subtree through - stops each component it finds before jQuery drops its data.
  Previously only `.empty()`/`.html()`/`.text()` were covered, and a `.remove()` orphaned
  the component with `on_stop()` never called. The three per-method overrides are gone;
  `.html()` keeps only its hand-written `data-sid` guard.
- Removed the lifecycle manager's write-only `active_components` set. It held a strong
  reference to every booted component until `_stop()`, so any component that left the
  document without being stopped was pinned forever together with its detached subtree.

## 2.3.71 (2026-09-20)

### Bug Fixes

- Load deduplication: a follower's copy of its leader's data goes through the cache serializer
  instead of a plain JSON round trip, so `register_cache_class()` instances, `Date`, `Map` and
  `Set` reach followers as live instances. Previously every follower rendered against plain
  objects (the `toJSON()` wire form) and the first method call threw, intermittently, because
  whether a follower exists is a render-timing race.

### Features

- `jqhtml.register_cache_class(Klass, { to_plain, from_plain })` registers a class whose wire
  form is not its own properties, such as one that defines `toJSON()` or keeps state in
  private fields. `to_plain` defaults to `toJSON()`. Such classes round-trip identically
  through the localStorage cache, `on_load()` normalization and the deduplication hand-off.
  `Date`, `Map` and `Set` now use the same hook.

## 2.3.70 (2026-09-15)

### Added

- Debug overlay: hover tabs are interactive. The pointer can move from a component onto
  one of its tabs without the outlines collapsing, and clicking a tab opens the inspector
  for that tab's component.
- Debug overlay: **Parent** and **Back** buttons in the inspector title bar walk the DOM
  component chain. Back tracks Parent, Ancestry and Instantiator steps and disappears at
  the component the walk started from; picking a new component on the page clears it.
- Debug overlay: the component the inspector is showing keeps an amber outline while the
  inspector is open. The hover outline takes precedence where both apply.
  See docs/reference/09_debugging_tools.md.

## 2.3.69 (2026-09-15)

### Added

- Debug overlay: the inspector modal has a fixed title bar, a scrolling body and a
  **Lifecycle:** footer with Reload / Refresh / Rerender / Reload w/o data. It opens on
  the left when the inspected component sits in the right half of the window. Hover tabs
  on components narrower than 400px may grow to 400px and are kept inside the right edge
  of the window. See docs/reference/09_debugging_tools.md.

## 2.3.68 (2026-09-15)

### Performance

- Interpolated text is escaped by string replacement rather than a DOM round trip per
  value, and the post-`innerHTML` element and component lookups are one query per pass
  instead of one per element. Measured -27% on text-heavy renders and -25% to -57% on
  large lists of tracked elements or child components. See packages/core/CHANGELOG.md.

### Added

- VS Code extension: three-tier headless test suite (stubbed unit tests, TextMate
  tokenisation snapshots, a real extension host under xvfb) wired into
  `./run-all-suites.sh`; plus the code-review fixes listed in
  packages/vscode-extension/CHANGELOG.md.
- `tests_benchmark/`: paired A/B render benchmarks of the working tree against the
  runtime at a pinned commit, both loaded in one page and alternated per iteration, plus
  a CPU profiler per scenario.

### Fixed

- `$(component)` returned a jQuery wrapper around the component object instead of the
  component's root element, so every jQuery call on it silently did nothing. See
  packages/core/CHANGELOG.md.
- Replacing a component on an element left `class=""` behind, swallowed a throwing
  `stop()` and overwrote the component anyway, and repaired a wrong tag only for
  server-rendered content (dropping the element's jQuery `.data()` when it did). See
  packages/core/CHANGELOG.md.
- In `'html'` cache mode, a parent whose child had no `on_load()` never became ready, and
  a `reload()` that injected cached HTML left inert markup when the reloaded data came
  back unchanged. See packages/core/CHANGELOG.md.
- A `"` in an interpolated attribute value could break out of the attribute. See
  packages/core/CHANGELOG.md.
- Recovering from a full localStorage quota wiped the cache a second time on the next
  write. See packages/core/CHANGELOG.md.
- The `create` event fired twice for every `.on('create')` subscriber. See
  packages/core/CHANGELOG.md.
- A hand-written `id` was rewritten to `<value>:<cid>` when the element also carried an
  event or `$` attribute. Plain ids are now emitted verbatim; use `$sid` for per-instance
  ids. See packages/core/CHANGELOG.md.
- A slot-only template whose parent template is missing or throws rendered an empty element
  with only a warning. It is now an error naming the component and the parent template. See
  packages/core/CHANGELOG.md.
- `<Define>` default attributes followed only the `extends=` chain, so a slot-only JS
  subclass inherited its parent's template but none of the parent `<Define>`'s `class=""`
  or attributes. They now resolve through the same chain templates do. An invocation
  attribute of `""` is also no longer overwritten by the `Define` default. See
  packages/core/CHANGELOG.md.

### Removed

- `jqhtml.render_template()`: a second, broken renderer that nothing called, with a
  duplicate slot-inheritance implementation that disagreed with the live one. See
  packages/core/CHANGELOG.md.

## 2.3.67 (2026-09-14)

### Added

- **Value printers.** `jqhtml.add_object_printer(fn)` lets `<%= %>`, `<%!= %>` and `<%br= %>`
  render an object. Printers chain in registration order; `undefined` declines, a string is
  treated as a literal at that site (escaped per construct), a `{component: {name, args, attrs}}`
  descriptor mounts the named component (no content). Primitives and arrays never enter the
  chain, attribute position never uses it, and an unhandled object throws instead of printing
  `[object Object]`. See packages/core/CHANGELOG.md and packages/parser/CHANGELOG.md.
- **Dynamic component tags.** `<{expression} />` and `<{expression}>…</{expression}>` mount the
  component whose name the expression evaluates to, validated at render time by the literal-tag
  rule; the closing expression must match the opening one textually. See
  packages/parser/CHANGELOG.md.

## 2.3.65 (2026-09-07)

### Fixed

- `component_name()` returns the invocation name (template tag, `.component('Name')`, boot
  placeholder) rather than the JS class name; template-only components no longer report
  `Jqhtml_Component`. See packages/core/CHANGELOG.md.
- A component whose whole body sits on the `<Define>` line compiled to an empty render
  function. See packages/parser/CHANGELOG.md.

### Added

- `jqhtml.debug_overlay` - an in-page component inspector in `@jqhtml/core`. `enable()`
  outlines the hovered component and its ancestors with name/args tabs and turns clicks into
  an inspector modal (identity, args, data, state, ancestry, instantiator, log to console);
  `disable()` removes it. Non-invasive by construction: the UI lives in a shadow root and
  page elements only receive outline classes. See packages/core/CHANGELOG.md.

## 2.3.62 (2026-09-07)

### Added

- Component names may carry a single leading underscore: `_Root_Layout`, `_Sidebar_Nav`.
  The rule is now `^_?[A-Z][A-Za-z0-9_]*$`, held in one place per package
  (`component-name.ts`, exported as `is_component_name` / `COMPONENT_NAME_PATTERN`) and used
  for the tag-vs-component decision, `<Define:>` validation, `register_component()` /
  `register_template()` validation, `closest()` bare-name selectors, the component-name
  classes on the rendered element, and class stripping on replacement. The prefix is a
  namespace reserved for framework-provided components so they cannot collide with
  application components. `__Foo` is rejected with the naming error; `_foo` is an HTML tag.
  Every previously valid name is unchanged.


## 2.3.61 (2026-09-03)

### Changed

- Handler attributes (`@click`, `on*`), hand-written `id=` scoping and `instantiator()` in
  slot bodies and default content now bind to the component whose template wrote the markup,
  matching `<%= %>` and `$sid`. A handler that previously ran with `this` set to the receiving
  component now runs against the defining one. See packages/core/CHANGELOG.md.

### Added

- `<Slot:name $params="a, b">` names the values a slot receives from `content('name', a, b)`.
  See packages/parser/CHANGELOG.md.

## 2.3.54 (2026-08-19)

### Added

- Runtime configuration for host integrations: `jqhtml.init($, config)` and
  `jqhtml.configure(config)`. `mode: 'development' | 'production'` describes the environment
  the application is running in, and jqhtml derives behaviour from it; individual flags can
  override a mode's defaults. Mode defaults to `'development'`, so an integration that passes
  nothing behaves exactly as before and production is opt-in. Read the resolved settings with
  `jqhtml.get_config()`. Two conventions ship with it:
  - `warn_uncacheable_args` (dev) — warns once per component+arg when a component with a
    custom `on_load()` is invoked with a non-serializable arg AND defines no `cache_id()`.
    Such a component still works, but silently opts out of cache reuse and load
    deduplication. The warning names the arg, says what was lost, recommends `cache_id()`,
    and gives a `[data-nocache]` selector for finding it in DevTools.
  - `debug_attributes` (off in prod) — suppresses `data-sid` and `data-cid`, both of which
    are debug-only mirrors: of the scoped `id="<sid>:<cid>"` that `$sid()` actually resolves
    against, and of the component's `_cid`. The runtime reads neither, so `$sid()`, `sid()`,
    scoping, `reload()` and `render()` are all unaffected. The separate TRANSIENT `data-cid`
    the instruction processor uses to correlate freshly-injected HTML with component data is
    functional and is never suppressed. Docs:
    `docs/reference/20_runtime_configuration.md`. Test: `tests/integration_config_modes`
    (34 assertions).

- `on_viewport_resize(viewport_width)` — a viewport hook on `Jqhtml_Component`. The
  framework installs one window `resize` listener, debounced 30ms, and dispatches to every
  component in the document; the hook also fires after every `on_render()` and every
  `on_ready()`. The argument is `window.innerWidth` in CSS pixels, matching what CSS media
  queries resolve against. Detached and stopped components are skipped and a handler that
  throws does not stop the fan-out, so components no longer bind (or leak) their own
  window listener — the previously documented "bind in `on_ready()`, unbind in
  `on_stop()`" pattern could strand a listener, because `on_stop()` is not guaranteed to
  run when a node is orphaned. Base implementation is a no-op. Test:
  `tests/viewport_resize`.

### Changed

- Cache keys now accept plain-data object and array args by deterministic CONTENT instead of
  declaring them uncacheable. Templates rebuild `{parent_id: 12}` on every render, so
  identity-based keying could never match and permanently opted the receiving component out of
  caching — a silent loss of instant SPA revisits. The keyable set is deliberately narrow
  (null, undefined, boolean, number, string, `Date`, arrays, and plain objects, nested freely);
  keys are sorted recursively, array order is preserved, and each value's shape is encoded so
  `{a:1}`, `[1]` and `"1"` cannot collide. Everything else DECLINES with a reason rather than
  being approximated — a serializer that dropped a function, as `JSON.stringify` does, would
  let two args differing only by a callback share a key and serve the wrong cached content.
  `._jqhtml_cache_id` / `jqhtml_cache_id()` still take precedence. New module:
  `packages/core/src/cache-key-serializer.ts`.
- **Deduplication deliberately does NOT use content keys** and still requires primitive args or
  an author-supplied id. A deduplicated follower never runs `on_load()` and adopts the leader's
  data with no revalidation, so a wrong key there is permanently wrong data, whereas a wrong
  cache key is corrected on revalidation. `_load()` now computes the cache identity and the
  dedup identity separately.
- `data-nocache` now carries the reason as `"<arg>:<reason>"` (e.g. `"on_select:function"`,
  `"rows:circular"`, `"model:non-plain-object"`), and the development warning explains which
  kind of value blocked keying.
- The persisted cache scope is now versioned by the core version, so a release that changes key
  shape invalidates everything stored under the old shape. Existing `_validate_scope()` clearing
  does the work; no new invalidation path.

### Fixed

- Deduplication could pair unrelated components under a `null` key. `should_execute_on_load()`
  and `register_leader()` used the key without checking for null, and `Map` accepts `null` as a
  key, so any two components that both failed to produce a key shared one coordination entry —
  a follower could adopt an unrelated component's data. Reachable whenever a component defined
  `cache_id()` (making its cache key non-null, so the early return no longer applied) while its
  args stayed un-keyable. Both call sites now treat a null key as "no coordination".

- `trigger()` no longer skips handlers when a `.once()` handler deregisters itself
  mid-dispatch. `event_trigger()` iterated the live callback array while `.once()`
  wrappers spliced themselves out of it, so removing the handler at index `i` shifted the
  next handler into an already-visited slot and the iterator advanced past it. With two
  pending `.once()` handlers on the same event only the first fired — and since the event
  is sticky from that point on, the second never fired at all, hanging any
  `await new Promise(r => comp.once(evt, r))` forever. N consecutive `.once()` handlers
  fired every other one; a `.once()` registered before an `.on()` skipped the `.on()` for
  that trigger. `trigger()` now dispatches to a snapshot of the handlers registered when
  it was called, which also stops a handler registered *during* dispatch from firing
  twice (once via `.on()`'s sticky replay, again when the live iterator reached it).
  Regression test: `tests/event_dispatch_snapshot`.

## 2.3.51 (2026-07-23)

### Fixed

- `<br>` no longer renders doubled. The compiler emitted a stray closing-tag string
  after every HTML5 void element (`</br>`, `</hr>`, …); browsers parse a stray `</br>`
  as a second `<br>` element, so every template `<br>` produced a double line break.
  Closing tags are no longer emitted for the void element set (`area base br col embed
  hr img input link meta source track wbr`). Regression test:
  `tests/void_element_single_render`.

## 2.3.50 (2026-07-21)

First public release on GitHub ([github.com/jqhtml/jqhtml](https://github.com/jqhtml/jqhtml)).
Versions 2.3.36–2.3.49 were internal-only; this entry summarizes everything shipped
since 2.3.35, the previous public npm release.

### Added

- `gate_load(promise)` — register promises in `on_create()` that delay the component's
  first `on_load()` (initial render is not delayed); released by gates settling,
  `reload()`, `refresh()`, or `stop()`
- `on_loaded()` lifecycle hook — runs after `on_load()` on the real component
  (`this.data` frozen, `this.$`/`this.state` accessible); introduced as `after_load()`
  and renamed
- `.once(event, callback)` — fire-exactly-once event listener with sticky-event support
- `'loaded'` and `'rendered'` lifecycle events; `rendered(callback?)` method resolving
  when the render chain completes, before the ready phase
- `<%br= %>` interpolation — escaped output with newline-to-`<br />` conversion
- SSR preload API (`jqhtml.start_data_capture()`, `get_captured_data()`,
  `set_preload_data()`, `clear_preload_data()`) — capture data server-side, replay on
  the client so hydration skips `on_load()`
- `render_spa` request type in `@jqhtml/ssr` — full-page SPA rendering through the
  app router in jsdom
- `_load_only` / `_load_render_only` lifecycle truncation flags with parent→child
  cascade, plus detached-boot optimization
- `//` whole-line comments inside `<% %>` code blocks
- Guards against hand-authored `data-sid`: creating it via jQuery HTML injection, or
  using `[data-sid...]` selectors in `.find()`/delegated `.on()`, now throws with
  guidance to use `$sid()`/`sid()`

### Changed

- `jqhtml.register(Class)` uses the class name by default; `static component_name` is
  only needed to survive minification
- `trigger('on_loaded')` renamed to `trigger('loaded')`
- `<% %>` code blocks are rejected inside attribute values at compile time (use
  `<%= expr %>` interpolation within quoted attribute values instead)
- CSS animations/transitions are automatically suppressed for one frame during the
  initial-boot double-render to prevent visual artifacts

### Fixed

- `render()` / `redraw()` now return the lifecycle promise — `await this.render()`
  resolves after DOM update, children ready, and `on_ready()`, as documented
- `stop()` now fires the `'stop'` event for registered listeners even when the
  component defines no `on_stop()`
- Template-authored `$_load_only=false` / `$_load_render_only=false` now correctly
  opt a child out of a cascading parent flag
- Cache serializer no longer drops shared (non-circular) references — the same object
  under two `this.data` keys survives a cache round-trip (as independent copies)

## 2.2.13 (2025-09-21)

**Note:** Version bump only for package @jqhtml/monorepo
