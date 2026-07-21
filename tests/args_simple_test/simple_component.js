class Simple_Component extends Jqhtml_Component {
  constructor(element, args) {
    console.log('[Simple Component] Constructor START');
    console.log('[Simple Component] args =', args);
    try {
      super(element, args);
      console.log('[Simple Component] Constructor END - success');
      console.log('[Simple Component] this.args =', this.args);
      console.log('[Simple Component] Is this.args frozen?', Object.isFrozen(this.args));
    } catch (error) {
      console.log('[Simple Component] Constructor ERROR:', error.message);
      console.log('[Simple Component] Stack:', error.stack);
      throw error;
    }
  }

  on_create() {
    console.log('[Simple Component] on_create() called');
    console.log('[Simple Component] this.data =', this.data);
    console.log('[Simple Component] Is this.data extensible?', Object.isExtensible(this.data));
  }

  async on_load() {
    console.log('[Simple Component] on_load() called');
    console.log('[Simple Component] this.args =', this.args);
    console.log('[Simple Component] this.args.myval =', this.args.myval);
    console.log('[Simple Component] this.data before assignment =', this.data);
    console.log('[Simple Component] Is this.data extensible?', Object.isExtensible(this.data));

    try {
      this.data.myval = this.args.myval;
      console.log('[Simple Component] ✅ Successfully set this.data.myval');
    } catch (error) {
      console.log('[Simple Component] ❌ Error setting this.data.myval:', error.message);
      throw error;
    }

    console.log('[Simple Component] this.data.myval =', this.data.myval);
  }

  on_ready() {
    console.log('[Simple Component] on_ready() called');
    console.log('[Simple Component] Rendered value:', this.$.find('p').text());
  }
}
