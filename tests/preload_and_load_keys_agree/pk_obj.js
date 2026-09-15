// Object arg ($filter is a plain-data object). Its cache key can only be produced by
// content serialization, which is exactly what the three derivations used to disagree on.
class Pk_Obj extends Jqhtml_Component {
  on_create() { this.data.v = 'default'; }

  async on_load() {
    window.__pk_obj_loads = (window.__pk_obj_loads || 0) + 1;
    // The await matters: it guarantees a freshly created component's data has NOT
    // been touched by on_load() when the test reads it straight after create().
    await new Promise(r => setTimeout(r, 50));
    this.data.v = window.__pk_obj_value || 'loaded';
  }
}
