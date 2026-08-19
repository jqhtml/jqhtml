// Records every on_viewport_resize() call it receives, tagged with the lifecycle
// phase that immediately preceded it.
//
// on_render() sets phase='render' and on_ready() sets phase='ready'; the framework
// fires on_viewport_resize() right after each, so the recorded tag identifies which
// automatic lifecycle call produced the entry. Every entry after that is 'resize'
// (driven by the debounced window listener).

class Vr_Recorder extends Jqhtml_Component {
  on_create() {
    this.state.phase = 'none';
    window.__vr[this.args.key] = [];
  }

  on_render() {
    this.state.phase = 'render';
  }

  on_ready() {
    this.state.phase = 'ready';
  }

  on_viewport_resize(viewport_width) {
    window.__vr[this.args.key].push({ width: viewport_width, phase: this.state.phase });
    this.state.phase = 'resize';
  }
}

window.jqhtml.register_component('Vr_Recorder', Vr_Recorder);
