// No attach/detach hooks: nothing is tracked unless someone calls .on('attach'|'detach').
class Plain_Widget extends Jqhtml_Component {
  on_create() {
    this.state.log = [];
  }
  on_stop() {
    this.state.log.push('on_stop');
  }
}
