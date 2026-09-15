# Attribute Quote Escaping

An interpolated attribute value containing `"` used to end the attribute in the HTML
string the instruction processor builds, so the remainder of the value became new
attributes on the element. The value is now emitted with `"` encoded as `&quot;`. This
test renders such a value on a plain tag, a tracked tag (`@click`), a tracked tag with a
hand-written `id`, and a component, and checks the attribute holds the whole value with
nothing injected.

It also guards audit bug 19: a hand-written `id` is emitted **exactly as written**, even on
a tracked element. `<p id="label" @click=…>` and `<label id="plain_label" for="x" @click=…>`
keep `label` and `plain_label`; nothing in the document carries a `label:<cid>` id. The old
behaviour rewrote a plain `id` to `<value>:<cid>` only when the element happened to carry
some other tracked attribute, so two otherwise identical elements disagreed. `$sid` is the
attribute for per-instance ids.
