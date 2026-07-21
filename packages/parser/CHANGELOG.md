# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
