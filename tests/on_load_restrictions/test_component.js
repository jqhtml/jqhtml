class Test_Component extends Jqhtml_Component {
  async on_load() {
    // Valid: reading this.args, writing this.data.
    const user_id = this.args.user_id;

    const blocked = [];
    const leaked = [];
    const probe = (name, fn) => {
      try { fn(); leaked.push(name); } catch (e) { blocked.push(name); }
    };

    probe('component_name', () => this.component_name());
    probe('$', () => this.$);
    probe('$sid', () => this.$sid('anything'));
    probe('render', () => this.render);
    probe('state', () => this.state);

    this.data = { user_id, loaded: true, blocked, leaked };
  }
}
