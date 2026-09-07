# Single Leading Underscore in Component Names

A component name is an optional SINGLE leading underscore, then a capital letter, then
letters, digits and underscores (`^_?[A-Z][A-Za-z0-9_]*$`). The underscore prefix is a
namespace reserved for framework-provided components (`_Root_Layout`) so they cannot
collide with application components. `__Foo` is not a component name; `_foo` is an HTML tag.

This test renders `<_Framework_Box>` and `<_Framework_Marker />` in real Chrome and checks
that definition, invocation, nesting, self-closing, the rendered class name, registration by
name, programmatic creation, `closest()`, class stripping on replacement, and rejection of
`__Foo` / `_foo` all behave exactly as they do for a name without the prefix.

The parser-level cases (`<_foo>` parsed as an element, `<Define:__Foo>` rejected) live in
`packages/parser/test/component-name.test.js`.
