// No override on the class: the hook is assigned to the instance in on_create().
class Vrr_Assigned extends Jqhtml_Component {
  on_create() {
    this.state.phase = 'none';
    this.on_viewport_resize = (viewport_width) => {
      window.__vrr.log.push({ key: this.args.key, phase: this.state.phase, width: viewport_width });
      this.state.phase = 'resize';
    };
  }
  on_render() { this.state.phase = 'render'; }
  on_ready() { this.state.phase = 'ready'; }
}
window.jqhtml.register_component('Vrr_Assigned', Vrr_Assigned);
