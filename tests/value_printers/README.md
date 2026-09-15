# Value Printers

Real-Chrome coverage for `jqhtml.add_object_printer()`: string results follow the escaping
rule of the construct, a component descriptor mounts the named component with separated
args and attrs (no wrapper element), printer-produced components repeat correctly in a
list, attribute position keeps plain coercion, primitives never reach the chain, and an
unhandled object throws. Chain semantics and every throw condition are unit-tested in
`packages/core/test/value-printers.test.js`.
