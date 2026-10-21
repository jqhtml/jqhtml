// The hook is a class field: an own property defined after the base constructor ran.
class Vrr_Field extends Jqhtml_Component {
  on_viewport_resize = (viewport_width) => {
    window.__vrr.log.push({ key: this.args.key, phase: 'field', width: viewport_width });
  };
}
window.jqhtml.register_component('Vrr_Field', Vrr_Field);
