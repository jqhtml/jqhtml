// Overrides on_attach/on_detach: interest is declared by the class itself, so tracking
// starts automatically after the first 'ready'.
class Watched_Widget extends Jqhtml_Component {
  on_create() {
    this.state.log = [];
  }
  on_ready() {
    this.state.log.push('ready');
  }
  on_attach() {
    this.state.log.push('on_attach');
  }
  on_detach() {
    this.state.log.push('on_detach');
  }
  on_stop() {
    this.state.log.push('on_stop');
  }
}
