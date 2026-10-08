// Overrides on_attach/on_detach: interest is declared by the class itself, so tracking
// starts automatically after the first 'ready'.
class Watched_Widget extends Jqhtml_Component {
  on_create() {
    this.state.log = [];
  }
  on_ready() {
    this.state.log.push('ready');
    // Live answer: true here for an in-document component even though 'attach'
    // has not fired yet (it fires after the 'ready' handlers).
    this.state.attached_in_ready = this.is_attached();
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
