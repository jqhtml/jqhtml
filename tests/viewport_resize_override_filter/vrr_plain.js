// Has a JS class but does not override on_viewport_resize().
class Vrr_Plain extends Jqhtml_Component {
  on_ready() { this.state.ready = true; }
}
window.jqhtml.register_component('Vrr_Plain', Vrr_Plain);
