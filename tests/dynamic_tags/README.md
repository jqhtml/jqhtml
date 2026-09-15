# Dynamic Component Tags

Real-Chrome coverage for `<{expression}>`: mounting the named component with args, the
placeholder parity with a literal undefined tag, content() delivery, nested dynamic
components, real DOM position inside a form (no wrapper), a different component after the
expression changes between renders, and render-time name validation. Compile-time behaviour
(both forms, the textual closing-tag match, the mismatch error) is unit-tested in
`packages/parser/test/dynamic-tags.test.js`.
