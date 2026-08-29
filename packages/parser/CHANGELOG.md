# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 2.3.59 (2026-08-29)

### Performance

* **codegen:** consecutive `_output.push()` calls on a line are merged into one
  varargs call - `push(a); push(b); push(c)` becomes `push(a, b, c)`. Across the
  test corpus this cuts push calls from 1036 to 600, and every template renders a
  byte-identical instruction array. Merging happens only within a line and only at
  bracket depth zero, so nested component closures keep their own `_output`
  bindings, control flow and IIFE expressions end a run, and the line-based
  sourcemap mapping is preserved by construction.

### Features

* **pre:** `<pre>` is now a raw-text element. Its body is lexed as literal text up to
  `</pre>`, so nested markup such as the standard `<pre><code>...</code></pre>` code
  block is preserved and interior whitespace survives byte for byte. Tokenising that
  body as tags was what destroyed the line breaks `<pre>` exists to keep. JQHTML
  delimiters still apply inside, so `<%= %>` interpolation works and the search for
  the closing tag skips expressions - `<%= "</pre>" %>` no longer ends the block.
  `<textarea>` keeps the stricter rule: its HTML content model is text only.

### Bug Fixes

* **raw tags:** an expression inside `<pre>` or `<textarea>` emitted the literal
  string `undefined`. Children were concatenated by reading `.content`, which an
  expression node does not have, so `<textarea><%= this.data.value %></textarea>` -
  the example the error message advertised as supported - rendered as the word
  `undefined`. Raw-tag content is now built as a JavaScript expression, with `<%= %>`
  escaped, `<%!= %>` raw, and a null or undefined value contributing nothing.

* **sourcemap:** `generateSourcemapForWrappedCode()` emitted one mapping segment per
  source line regardless of how many lines the generated code had. A component whose
  body renders nothing compiles to a one-line render function, so a template with a
  multi-line `<%-- --%>` header named more generated lines than existed. Consumers
  that rebuild output from the map - `SourceNode.fromStringWithSourceMap`, which
  bundlers use for concatenation - materialise each of those lines as a bare
  `undefined` identifier, which throws at top level when the bundle executes. The 1:1
  run is now bounded by the generated output.
* **sourcemap:** a segment count that disagrees with the generated line count now
  throws instead of writing a warning to the console and emitting the map anyway.

### Testing

* **regression corpus:** a fixture with no baseline is now a failure rather than a
  silent skip - baselines are only written for files that compile, so "no baseline"
  meant "this fixture no longer compiles". Nine of the corpus's fixtures had dropped
  out of the run that way while the suite still reported success. Fixtures that are
  uncompilable on purpose are declared in `test-regression/uncompilable-fixtures.json`
  with the exact error they must produce, which is asserted rather than exempted.
* **sourcemap validation:** the validator drove `CodeGenerator` directly and looked for
  an inline map on each `render_function`, where none is ever written, so every run
  reported "No sourcemap generated" and it never once exercised the code it is named
  for. It now compiles through `compileTemplate`, asserts that the segment count
  matches the generated line count, resolves every generated line through
  `SourceMapConsumer`, and exits non-zero on failure.

## 2.2.13 (2025-09-21)

**Note:** Version bump only for package @jqhtml/parser





## 2.1.10 (2025-09-18)

**Note:** Version bump only for package @jqhtml/parser





## 2.1.9 (2025-09-18)

**Note:** Version bump only for package @jqhtml/parser





# Parser Package Changelog

## [2.0.0-alpha] - December 2024

### Task 1: Lexer/Tokenizer ✅
- Character-based scanning without regex
- Full position tracking (line, column, absolute)
- Support for all v1 syntax
- Added v2 slot syntax tokens

### Task 2: AST Builder ✅
- Recursive descent parser
- Clean node types for all constructs
- Error messages with position info
- Added SlotNode for v2 slots

### Task 3: Code Generator ✅
- Generates instruction arrays: `{tag:...}`, `{comp:...}`, `{slot:...}`
- Functions return `[_output, this]` tuple
- Modern JavaScript with arrow functions
- HTML parsing for proper tag instructions

### Task 4: Component Integration ✅
- Runtime processes instructions into DOM
- `with_template()` mixin for component integration
- Full test suite demonstrating pipeline
- Browser and Node.js compatibility

### Task 5: Slot System ✅
- Lexer recognizes `<#name>` and `</#name>`
- Parser builds SlotNode AST nodes
- Generator creates slot instructions
- Self-closing slot support

### Task 6: Nested Components ✅
- Enhanced lexer to tokenize HTML tags properly
- Added TAG_OPEN, TAG_CLOSE, TAG_NAME, SELF_CLOSING tokens
- Parser distinguishes components (capital letter) from HTML tags
- Generates proper `{comp:[name, props, contentFn]}` for components with children
- Content function contains slots and default content
- Support for both brace-style and colon-style control flow

### Task 7: Enhanced JavaScript and Interpolation ✅
- Regular JavaScript blocks now pass through unchanged
- Only PHP-style control flow (with colons) gets special parsing
- Added `<%!= %>` for unescaped output
- String-aware JavaScript scanning handles `'%>'` inside strings
- Attribute value interpolation: `<div class="foo <%= bar %>">`
- Both `<%= %>` and `<%!= %>` work identically in attributes (no escaping needed)
- Single expressions and compound interpolations both supported

### Task 8: $ Attribute System ✅
- `$sid="name"` compiles to `id="name:_cid"` for component-scoped IDs
- Other `$foo="bar"` attributes compile to `data-foo="bar"`
- Render functions now receive `_cid` as first parameter
- Quoted values (`$theme="dark"`) treated as strings
- Unquoted values (`$user=currentUser`) treated as JavaScript expressions
- Content functions capture parent component's `_cid` through lexical closure
- Component method `this.$sid('name')` returns `$('#name:' + this._cid)`

### Current State

The parser now fully supports:
- Component definitions with `<Define:Name>`
- Component invocations with `<ComponentName>`
- HTML tags with proper instruction generation
- Slots inside component invocations
- Regular JavaScript control flow (`if (x) { }`)
- PHP-style control flow (`if (x): endif;`)
- Attribute interpolation for dynamic values
- Escaped (`<%= %>`) and unescaped (`<%!= %>`) output
- Proper handling of special characters in strings

All components with children use the critical 3-parameter form where slots are inside the content function.

### Next Task

**Task 9: Error Handling** - Better error messages with line/column numbers and helpful context.
