// What each phase saw is recorded on a window-level tally: this.data must not be used
// as scratch space outside on_create()/on_load().
window.__dp_seen = window.__dp_seen || {};

class Component_With_Create_Data extends Jqhtml_Component {
  on_create() {
    window.__dp_seen.extensible_in_create = Object.isExtensible(this.data);
    this.data.foo = 'bar';
    console.log('[Component_With_Create_Data] on_create() set this.data.foo =', this.data.foo);
  }

  on_render() {
    window.__dp_seen.render = this.data.foo;
    console.log('[Component_With_Create_Data] on_render() sees this.data.foo =', this.data.foo);
  }

  on_ready() {
    window.__dp_seen.ready = this.data.foo;
    console.log('[Component_With_Create_Data] on_ready() sees this.data.foo =', this.data.foo);
  }
}
