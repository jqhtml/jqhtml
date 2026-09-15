// cache_id() component: its key shape is `<name>::<cache_id()>`, which no client-side
// derivation from args can reproduce - the captured key has to travel with the entry.
class Pk_Id extends Jqhtml_Component {
  cache_id() { return 'custom_1'; }

  on_create() { this.data.v = 'default'; }

  async on_load() {
    window.__pk_id_loads = (window.__pk_id_loads || 0) + 1;
    await new Promise(r => setTimeout(r, 50));
    this.data.v = 'loaded';
  }
}
