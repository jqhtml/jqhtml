// Overrides on_viewport_resize() as a class method. Every call is logged as
// { key, phase, width }; phase is the lifecycle step that preceded the call
// ('render' / 'ready'), or 'resize' for calls from the window dispatcher.
class Vrr_Hooked extends Jqhtml_Component {
  on_create() { this.state.phase = 'none'; }
  on_render() { this.state.phase = 'render'; }
  on_ready() { this.state.phase = 'ready'; }
  on_viewport_resize(viewport_width) {
    window.__vrr.log.push({ key: this.args.key, phase: this.state.phase, width: viewport_width });
    this.state.phase = 'resize';
  }
}
window.jqhtml.register_component('Vrr_Hooked', Vrr_Hooked);
