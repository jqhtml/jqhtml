// A parent whose template mounts a tracked child, so parent render() re-renders can be
// tested: the old child must be detached and stopped before the new one is created.
class Host_Widget extends Jqhtml_Component {
  on_create() {
    this.state.log = [];
  }
  on_stop() {
    this.state.log.push('on_stop');
  }
}
