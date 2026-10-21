class Eis_Target extends Jqhtml_Component {
  on_render() { this.state.renders = (this.state.renders || 0) + 1; }
}
