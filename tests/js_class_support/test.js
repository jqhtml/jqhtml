class Hello_Test extends Jqhtml_Component {
  async on_ready() {
    console.log('✅ Hello World from JS class on_ready()!');
    console.log(`Component name: ${this.component_name()}`);
    console.log(`Component CID: ${this._cid}`);
  }
}
