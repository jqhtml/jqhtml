// No on_load(): its data is whatever on_create() set, and it never fetches.
class Plain_Counter extends Jqhtml_Component {
  on_create() {
    this.data.value = 'from-create';
    this.state.renders = 0;
    this.state.readies = 0;
    this.state.ready_events = 0;
    this.on('ready', () => { this.state.ready_events++; });
  }
  on_render() { this.state.renders++; }
  on_ready() { this.state.readies++; }
}
