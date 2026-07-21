class Component_With_Create_Data extends Jqhtml_Component {
  on_create() {
    console.log('[Component_With_Create_Data] on_create() START');
    console.log('[Component_With_Create_Data] this.data BEFORE =', this.data);
    console.log('[Component_With_Create_Data] Is this.data extensible?', Object.isExtensible(this.data));

    this.data.foo = "bar";

    console.log('[Component_With_Create_Data] this.data AFTER =', this.data);
    console.log('[Component_With_Create_Data] this.data.foo =', this.data.foo);
    console.log('[Component_With_Create_Data] on_create() END');
  }

  on_render() {
    console.log('[Component_With_Create_Data] on_render() called');
    console.log('[Component_With_Create_Data] this.data in on_render =', this.data);
    console.log('[Component_With_Create_Data] this.data.foo in on_render =', this.data.foo);
  }

  on_ready() {
    console.log('[Component_With_Create_Data] on_ready() called');
    console.log('[Component_With_Create_Data] this.data in on_ready =', this.data);
    console.log('[Component_With_Create_Data] this.data.foo in on_ready =', this.data.foo);
  }
}
