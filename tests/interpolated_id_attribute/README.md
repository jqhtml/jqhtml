# Interpolated id Attribute

A hand-written `id` with an interpolation, `<p id="x_<%= a || b %>">`, used to compile to
`"id": "[object Object]"`: codegen special-cased `id` and only understood quoted values,
so it stringified the interpolated-value object. An `id` now takes the same path as any
other attribute - text parts and parenthesised expressions concatenated, exactly like
`class="..."` - while keeping the documented rule that a hand-written `id` is emitted
exactly as written, with no cid scoping (`$sid` is the scoped one).

The test renders an `||` expression, a ternary (precedence), an interpolated `id` on a
tracked (`@click`) element, and a static `id`, and checks each element's id exactly.
