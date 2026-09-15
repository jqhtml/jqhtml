class Ce_Probe extends Jqhtml_Component {
  on_create() {
    // Subscribe from INSIDE on_create(), which is the only point early enough to observe
    // the event itself: component.create() emits 'create' at its very end, and
    // boot_component() used to emit it a second time immediately after create() returned.
    // A listener attached after .component() returns sees only the sticky replay, so it
    // cannot tell one trigger from two.
    this.state.on_fires = 0;
    this.state.once_fires = 0;
    this.on('create', () => { this.state.on_fires++; });
    this.once('create', () => { this.state.once_fires++; });
  }
}
