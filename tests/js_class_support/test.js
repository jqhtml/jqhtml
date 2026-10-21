class Hello_Test extends Jqhtml_Component {
  on_create() {
    this.state.hooks = ['on_create'];
  }

  on_render() {
    this.state.hooks.push('on_render');
  }

  greeting() {
    return 'Hello from ' + this.component_name();
  }

  async on_ready() {
    this.state.hooks.push('on_ready');
    console.log('✅ Hello World from JS class on_ready()!');
    console.log(`Component name: ${this.component_name()}`);
    console.log(`Component CID: ${this._cid}`);

    let passed = 0;
    let failed = 0;
    const assert = (name, condition, detail) => {
      if (condition) {
        console.log('   PASS: ' + name);
        passed++;
      } else {
        console.log('   FAIL: ' + name + (detail !== undefined ? ' - got ' + JSON.stringify(detail) : ''));
        failed++;
      }
    };

    // The paired .js class is the one instantiated for <Define:Hello_Test>
    assert('instance is the paired Hello_Test class', this instanceof Hello_Test && this.constructor === Hello_Test);
    assert('Hello_Test extends Jqhtml_Component', this instanceof Jqhtml_Component);
    assert('the element maps back to this instance', $('#app').component() === this);
    assert('component_name() is "Hello_Test"', this.component_name() === 'Hello_Test', this.component_name());
    assert('_cid is a non-empty string', typeof this._cid === 'string' && this._cid.length > 0, this._cid);
    assert('class methods are callable', this.greeting() === 'Hello from Hello_Test', this.greeting());
    assert('hooks ran in order on_create, on_render, on_ready',
      JSON.stringify(this.state.hooks) === JSON.stringify(['on_create', 'on_render', 'on_ready']), this.state.hooks);

    // The template was rendered into the root element
    assert('template rendered into the component root',
      this.$.find('.hello-container p').text().trim() === 'Hello Test Component', this.$.text().trim());
    assert('root carries the Hello_Test class', this.$.hasClass('Hello_Test'));

    console.log('SUMMARY: ' + passed + ' passed, ' + failed + ' failed');
    window.testPassed = (failed === 0);
  }
}
