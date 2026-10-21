# Slot Handler Binding Paths

`@click` handlers and `instantiator()` in caller-written content belong to the component
whose template wrote the markup (`content_handler_context` covers the one-level case). This
test covers three more paths:

A. **Slot-only templates.** `Shb_Extends_Grid` (`extends="Shb_Grid_Base"`) and
   `Shb_Class_Grid` (`class Shb_Class_Grid extends Shb_Grid_Base`, no `extends=`) define
   only `<Slot:>` bodies, rendered inside the inherited parent template. Their handlers run
   with `this` = the grid instance, not the page that invoked it, and a component in a slot
   body reports the grid from `instantiator()`.

B. **After a re-render.** After the receiving `Shb_Box` calls `render()`, a `<Slot:>` body
   and default content still bind to the page that wrote them, and a component in the slot
   body still reports the page. The same holds after the page itself re-renders.

C. **Three-level forwarding.** The page writes `<Slot:item>` for `Shb_Middle`, which
   forwards it to `Shb_Leaf` (`<Slot:item><%= content('item', item) %></Slot:item>`). The
   handler runs with `this` = the page, never the middle or leaf component, also after the
   leaf re-renders; a component in the forwarded body reports the page.

With the definer ignored (`const definer = context` in `process_instruction_to_html`), the
12 assertions of B and C fail. A passes either way (there the definer is the receiving
component); it guards against binding to the invoking page instead.
