# sourcemap_runtime_error

A runtime error thrown by the second of two `<%= %>` expressions on one template line
maps, through the compiled template's inline sourcemap, to that expression's line and
column.

`check.mjs` compiles `test.jqhtml` with an inline map, serves it as its own `<script>`
next to jQuery and `@jqhtml/core` (the harness inlines templates into a webpack bundle,
where the template's own map is not used), boots the component with the real runtime,
takes the template frame's position from the error stack the browser reports, and
resolves it in Node with the `source-map` package. It prints its own `VERDICT:` line.
